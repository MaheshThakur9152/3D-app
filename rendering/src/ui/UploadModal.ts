/**
 * UploadModal.ts
 * iJewel-Style Model Import Preparation Dialog with Standard & Advanced Settings,
 * persistence, telemetry progress tracking, and unified pipeline execution.
 */

import { DynamicCadLoader } from "../cad/DynamicCadLoader";
import { RoleMappingModal } from "./RoleMappingModal";

export interface ImportSettings {
    autoConvertGlb: boolean;
    autoCentre: boolean;
    autoScale: boolean;
    protectOriginal: boolean;
    sourceUnit: 'auto' | 'mm' | 'cm' | 'm' | 'inches';
    visibleOnly: boolean;
    excludeConstruction: boolean;
    preserveFacetNormals: boolean;
}

const DEFAULT_SETTINGS: ImportSettings = {
    autoConvertGlb: true,
    autoCentre: true,
    autoScale: true,
    protectOriginal: true,
    sourceUnit: 'auto',
    visibleOnly: true,
    excludeConstruction: true,
    preserveFacetNormals: true
};

export class UploadModal {
    private container: HTMLElement;
    private loader: DynamicCadLoader;
    private roleMapper: RoleMappingModal;
    private apiBaseUrl: string;
    private onUploadedCallback?: (manifest: any, glbUrl: string) => void;
    private selectedFile: File | null = null;
    private settings: ImportSettings = { ...DEFAULT_SETTINGS };

    constructor(
        loader: DynamicCadLoader,
        roleMapper: RoleMappingModal,
        apiBaseUrl = "http://localhost:5000"
    ) {
        this.loader = loader;
        this.roleMapper = roleMapper;
        this.apiBaseUrl = apiBaseUrl;
        this.loadSettings();
        this.container = this.createModalElement();
        document.body.appendChild(this.container);
    }

    private loadSettings(): void {
        try {
            const saved = localStorage.getItem('ijewel_import_settings');
            if (saved) {
                this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            }
        } catch {
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    private saveSettings(): void {
        try {
            localStorage.setItem('ijewel_import_settings', JSON.stringify(this.settings));
        } catch {
            // Storage fallback
        }
    }

    private createModalElement(): HTMLElement {
        const modal = document.createElement("div");
        modal.className = "cad-upload-modal-overlay";
        modal.style.display = "none";
        modal.innerHTML = `
            <div class="cad-upload-modal">
                <div class="modal-header">
                    <div>
                        <h3>Import 3D Model / Jewelry CAD</h3>
                        <p class="modal-subtitle">Auto-centers, scales, and prepares models for photorealistic studio preview</p>
                    </div>
                    <button class="close-btn">&times;</button>
                </div>

                <div class="drop-zone" id="cad-drop-zone">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#52322B" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p class="drop-text">Drag and drop your <strong>.3dm</strong> or <strong>.glb</strong> file here</p>
                    <p class="drop-subtext">or click to browse from computer (Max 100MB)</p>
                    <div class="selected-file-pill" style="display: none;"></div>
                    <input type="file" id="cad-file-input" accept=".3dm,.glb" style="display: none;" />
                </div>

                <!-- iJewel Import Options Section -->
                <div class="import-options-section">
                    <div class="options-header">Standard Settings</div>
                    <div class="options-grid">
                        <label class="checkbox-label" title="Converts .3dm to WebGi GLB; validates existing GLBs">
                            <input type="checkbox" id="opt-convert" ${this.settings.autoConvertGlb ? 'checked' : ''} />
                            <span>Auto convert to GLB</span>
                        </label>
                        <label class="checkbox-label" title="Centers the ring at the studio origin">
                            <input type="checkbox" id="opt-centre" ${this.settings.autoCentre ? 'checked' : ''} />
                            <span>Auto centre</span>
                        </label>
                        <label class="checkbox-label" title="Normalizes viewing scale while preserving manufacturing master units">
                            <input type="checkbox" id="opt-scale" ${this.settings.autoScale ? 'checked' : ''} />
                            <span>Auto scale</span>
                        </label>
                        <label class="checkbox-label" title="Preserves original CAD file as immutable asset in storage">
                            <input type="checkbox" id="opt-protect" ${this.settings.protectOriginal ? 'checked' : ''} />
                            <span>Protect original upload</span>
                        </label>
                    </div>

                    <!-- Collapsible Advanced Settings -->
                    <div class="advanced-toggle" id="advanced-toggle">
                        <span class="toggle-arrow">▸</span>
                        <span>Advanced CAD & Geometry Settings</span>
                    </div>

                    <div class="advanced-section" id="advanced-section" style="display: none;">
                        <div class="advanced-row">
                            <label for="opt-units">Source Units:</label>
                            <select id="opt-units" class="opt-select">
                                <option value="auto" ${this.settings.sourceUnit === 'auto' ? 'selected' : ''}>Auto-Detect (from CAD)</option>
                                <option value="mm" ${this.settings.sourceUnit === 'mm' ? 'selected' : ''}>Millimeters (mm)</option>
                                <option value="cm" ${this.settings.sourceUnit === 'cm' ? 'selected' : ''}>Centimeters (cm)</option>
                                <option value="m" ${this.settings.sourceUnit === 'm' ? 'selected' : ''}>Meters (m)</option>
                                <option value="inches" ${this.settings.sourceUnit === 'inches' ? 'selected' : ''}>Inches (in)</option>
                            </select>
                        </div>
                        <div class="options-grid" style="margin-top: 8px;">
                            <label class="checkbox-label" title="Skips objects on hidden CAD layers">
                                <input type="checkbox" id="opt-visible" ${this.settings.visibleOnly ? 'checked' : ''} />
                                <span>Visible objects only</span>
                            </label>
                            <label class="checkbox-label" title="Excludes construction curves, bounding boxes, and helper points">
                                <input type="checkbox" id="opt-construction" ${this.settings.excludeConstruction ? 'checked' : ''} />
                                <span>Exclude construction</span>
                            </label>
                            <label class="checkbox-label" title="Preserves sharp flat facet normals for diamond sparkle">
                                <input type="checkbox" id="opt-facets" ${this.settings.preserveFacetNormals ? 'checked' : ''} />
                                <span>Diamond facet normals</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="modal-actions-row">
                    <button class="btn-modal-cancel">Cancel</button>
                    <button class="btn-modal-import" id="btn-start-import" disabled>Prepare & Import</button>
                </div>

                <div class="upload-progress-container" style="display: none;">
                    <div class="progress-label-row">
                        <span class="progress-status">Uploading...</span>
                        <span class="progress-percent">0%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: 0%;"></div>
                    </div>
                    <div class="progress-substatus">Connecting to CAD conversion engine...</div>
                </div>
                <div class="upload-error-message" style="display: none;"></div>
            </div>
        `;

        const dropZone = modal.querySelector("#cad-drop-zone") as HTMLElement;
        const fileInput = modal.querySelector("#cad-file-input") as HTMLInputElement;
        const closeBtn = modal.querySelector(".close-btn") as HTMLElement;
        const cancelBtn = modal.querySelector(".btn-modal-cancel") as HTMLElement;
        const importBtn = modal.querySelector("#btn-start-import") as HTMLButtonElement;
        const advToggle = modal.querySelector("#advanced-toggle") as HTMLElement;
        const advSection = modal.querySelector("#advanced-section") as HTMLElement;
        const toggleArrow = modal.querySelector(".toggle-arrow") as HTMLElement;

        // Settings checkboxes
        const optConvert = modal.querySelector("#opt-convert") as HTMLInputElement;
        const optCentre = modal.querySelector("#opt-centre") as HTMLInputElement;
        const optScale = modal.querySelector("#opt-scale") as HTMLInputElement;
        const optProtect = modal.querySelector("#opt-protect") as HTMLInputElement;
        const optUnits = modal.querySelector("#opt-units") as HTMLSelectElement;
        const optVisible = modal.querySelector("#opt-visible") as HTMLInputElement;
        const optConstruction = modal.querySelector("#opt-construction") as HTMLInputElement;
        const optFacets = modal.querySelector("#opt-facets") as HTMLInputElement;

        const updateSettingsState = () => {
            this.settings.autoConvertGlb = optConvert.checked;
            this.settings.autoCentre = optCentre.checked;
            this.settings.autoScale = optScale.checked;
            this.settings.protectOriginal = optProtect.checked;
            this.settings.sourceUnit = optUnits.value as any;
            this.settings.visibleOnly = optVisible.checked;
            this.settings.excludeConstruction = optConstruction.checked;
            this.settings.preserveFacetNormals = optFacets.checked;
            this.saveSettings();
        };

        [optConvert, optCentre, optScale, optProtect, optUnits, optVisible, optConstruction, optFacets].forEach(el => {
            el.addEventListener("change", updateSettingsState);
        });

        // Advanced collapsible toggle
        advToggle.addEventListener("click", () => {
            const isHidden = advSection.style.display === "none";
            advSection.style.display = isHidden ? "block" : "none";
            toggleArrow.textContent = isHidden ? "▾" : "▸";
        });

        closeBtn.addEventListener("click", () => this.hide());
        cancelBtn.addEventListener("click", () => this.hide());
        dropZone.addEventListener("click", () => fileInput.click());

        dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("dragover");
        });

        dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                this.setFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files.length > 0) {
                this.setFile(fileInput.files[0]);
            }
        });

        importBtn.addEventListener("click", () => {
            if (this.selectedFile) {
                this.executePipeline(this.selectedFile);
            }
        });

        return modal;
    }

    private setFile(file: File): void {
        const lower = file.name.toLowerCase();
        if (!lower.endsWith(".3dm") && !lower.endsWith(".glb")) {
            this.showError("Please select a valid 3D model (.3dm or .glb).");
            return;
        }

        if (file.size > 100 * 1024 * 1024) {
            this.showError("File size exceeds maximum allowed limit of 100MB.");
            return;
        }

        this.selectedFile = file;
        const filePill = this.container.querySelector(".selected-file-pill") as HTMLElement;
        const importBtn = this.container.querySelector("#btn-start-import") as HTMLButtonElement;
        const errorMsg = this.container.querySelector(".upload-error-message") as HTMLElement;

        errorMsg.style.display = "none";
        filePill.style.display = "block";
        filePill.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        importBtn.removeAttribute("disabled");
    }

    public show(): void {
        this.container.style.display = "flex";
        this.resetState();
    }

    public hide(): void {
        this.container.style.display = "none";
    }

    public onModelUploaded(callback: (manifest: any, glbUrl: string) => void): void {
        this.onUploadedCallback = callback;
    }

    private resetState(): void {
        const dropZone = this.container.querySelector("#cad-drop-zone") as HTMLElement;
        const optionsSec = this.container.querySelector(".import-options-section") as HTMLElement;
        const actionsRow = this.container.querySelector(".modal-actions-row") as HTMLElement;
        const progressContainer = this.container.querySelector(".upload-progress-container") as HTMLElement;
        const errorMsg = this.container.querySelector(".upload-error-message") as HTMLElement;
        const fileInput = this.container.querySelector("#cad-file-input") as HTMLInputElement;
        const filePill = this.container.querySelector(".selected-file-pill") as HTMLElement;
        const importBtn = this.container.querySelector("#btn-start-import") as HTMLButtonElement;

        dropZone.style.display = "flex";
        optionsSec.style.display = "block";
        actionsRow.style.display = "flex";
        progressContainer.style.display = "none";
        errorMsg.style.display = "none";
        fileInput.value = "";
        filePill.style.display = "none";
        this.selectedFile = null;
        importBtn.setAttribute("disabled", "true");
    }

    private showError(msg: string): void {
        const errorMsg = this.container.querySelector(".upload-error-message") as HTMLElement;
        errorMsg.textContent = msg;
        errorMsg.style.display = "block";

        const dropZone = this.container.querySelector("#cad-drop-zone") as HTMLElement;
        const optionsSec = this.container.querySelector(".import-options-section") as HTMLElement;
        const actionsRow = this.container.querySelector(".modal-actions-row") as HTMLElement;
        const progressContainer = this.container.querySelector(".upload-progress-container") as HTMLElement;

        dropZone.style.display = "flex";
        optionsSec.style.display = "block";
        actionsRow.style.display = "flex";
        progressContainer.style.display = "none";
    }

    private updateProgress(percent: number, status: string, substatus: string): void {
        const progressContainer = this.container.querySelector(".upload-progress-container") as HTMLElement;
        const dropZone = this.container.querySelector("#cad-drop-zone") as HTMLElement;
        const optionsSec = this.container.querySelector(".import-options-section") as HTMLElement;
        const actionsRow = this.container.querySelector(".modal-actions-row") as HTMLElement;
        const percentEl = this.container.querySelector(".progress-percent") as HTMLElement;
        const statusEl = this.container.querySelector(".progress-status") as HTMLElement;
        const substatusEl = this.container.querySelector(".progress-substatus") as HTMLElement;
        const fillEl = this.container.querySelector(".progress-bar-fill") as HTMLElement;

        dropZone.style.display = "none";
        optionsSec.style.display = "none";
        actionsRow.style.display = "none";
        progressContainer.style.display = "block";

        percentEl.textContent = `${Math.round(percent)}%`;
        statusEl.textContent = status;
        substatusEl.textContent = substatus;
        fillEl.style.width = `${percent}%`;
    }

    private async executePipeline(file: File): Promise<void> {
        this.updateProgress(15, "Uploading CAD file...", `Sending ${file.name} to server`);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("options", JSON.stringify(this.settings));

        try {
            const uploadRes = await fetch(`${this.apiBaseUrl}/api/v1/upload`, {
                method: "POST",
                body: formData
            });

            if (!uploadRes.ok) {
                const errData = await uploadRes.json().catch(() => ({}));
                throw new Error(errData.message || `Upload failed (${uploadRes.status})`);
            }

            const { jobId, modelId } = await uploadRes.json();
            this.updateProgress(35, "Conversion queued...", "Waiting for CAD conversion worker");

            // Poll job status
            await this.pollJobStatus(jobId, modelId);
        } catch (err: any) {
            this.showError(err.message || "An error occurred during upload.");
        }
    }

    private async pollJobStatus(jobId: string, modelId: string): Promise<void> {
        let completed = false;
        let attempts = 0;

        while (!completed && attempts < 90) {
            await new Promise(r => setTimeout(r, 800));
            attempts++;

            const res = await fetch(`${this.apiBaseUrl}/api/v1/jobs/${jobId}`);
            if (!res.ok) continue;

            const job = await res.json();
            if (job.status === "processing") {
                this.updateProgress(
                    Math.max(40, job.progress),
                    "Tessellating CAD geometry...",
                    "Extracting surfaces and computing diamond facet normals"
                );
            } else if (job.status === "completed") {
                completed = true;
                this.updateProgress(90, "Centering & Auto-Scaling...", "Applying canonical studio viewport fit");

                // Fetch manifest and load into viewer
                const manifestRes = await fetch(`${this.apiBaseUrl}/api/v1/models/${modelId}/manifest`);
                const manifest = await manifestRes.json();

                const glbUrl = `${this.apiBaseUrl}/api/v1/models/${modelId}/model.glb`;
                await this.loader.loadModel(glbUrl, manifest);

                this.hide();

                if (this.onUploadedCallback) {
                    this.onUploadedCallback(manifest, glbUrl);
                }

                // If any components are unassigned, automatically open role mapper
                const hasUnassigned = manifest.components && manifest.components.some((c: any) => c.role === "unassigned");
                if (hasUnassigned) {
                    this.roleMapper.show(manifest);
                }
                return;
            } else if (job.status === "failed") {
                throw new Error(job.error || "CAD conversion failed on server.");
            }
        }

        throw new Error("Conversion timed out. Please try again.");
    }
}

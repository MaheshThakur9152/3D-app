/**
 * UploadModal.ts
 * Drag-and-drop CAD upload modal with progress tracking and job polling.
 */

import { DynamicCadLoader } from "../cad/DynamicCadLoader";
import { RoleMappingModal } from "./RoleMappingModal";

export class UploadModal {
    private container: HTMLElement;
    private loader: DynamicCadLoader;
    private roleMapper: RoleMappingModal;
    private apiBaseUrl: string;
    private onUploadedCallback?: (manifest: any, glbUrl: string) => void;

    constructor(
        loader: DynamicCadLoader,
        roleMapper: RoleMappingModal,
        apiBaseUrl = "http://localhost:5000"
    ) {
        this.loader = loader;
        this.roleMapper = roleMapper;
        this.apiBaseUrl = apiBaseUrl;
        this.container = this.createModalElement();
        document.body.appendChild(this.container);
    }

    private createModalElement(): HTMLElement {
        const modal = document.createElement("div");
        modal.className = "cad-upload-modal-overlay";
        modal.style.display = "none";
        modal.innerHTML = `
            <div class="cad-upload-modal">
                <div class="modal-header">
                    <h3>Import 3D Model / CAD</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="drop-zone" id="cad-drop-zone">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#52322B" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p class="drop-text">Drag and drop your <strong>.3dm</strong> or <strong>.glb</strong> file here</p>
                    <p class="drop-subtext">or click to browse from computer (Max 100MB)</p>
                    <input type="file" id="cad-file-input" accept=".3dm,.glb" style="display: none;" />
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

        closeBtn.addEventListener("click", () => this.hide());
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
                this.handleFileSelected(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files.length > 0) {
                this.handleFileSelected(fileInput.files[0]);
            }
        });

        return modal;
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
        const progressContainer = this.container.querySelector(".upload-progress-container") as HTMLElement;
        const errorMsg = this.container.querySelector(".upload-error-message") as HTMLElement;
        const fileInput = this.container.querySelector("#cad-file-input") as HTMLInputElement;

        dropZone.style.display = "flex";
        progressContainer.style.display = "none";
        errorMsg.style.display = "none";
        fileInput.value = "";
    }

    private showError(msg: string): void {
        const errorMsg = this.container.querySelector(".upload-error-message") as HTMLElement;
        errorMsg.textContent = msg;
        errorMsg.style.display = "block";

        const dropZone = this.container.querySelector("#cad-drop-zone") as HTMLElement;
        dropZone.style.display = "flex";
        const progressContainer = this.container.querySelector(".upload-progress-container") as HTMLElement;
        progressContainer.style.display = "none";
    }

    private updateProgress(percent: number, status: string, substatus: string): void {
        const progressContainer = this.container.querySelector(".upload-progress-container") as HTMLElement;
        const dropZone = this.container.querySelector("#cad-drop-zone") as HTMLElement;
        const percentEl = this.container.querySelector(".progress-percent") as HTMLElement;
        const statusEl = this.container.querySelector(".progress-status") as HTMLElement;
        const substatusEl = this.container.querySelector(".progress-substatus") as HTMLElement;
        const fillEl = this.container.querySelector(".progress-bar-fill") as HTMLElement;

        dropZone.style.display = "none";
        progressContainer.style.display = "block";

        percentEl.textContent = `${Math.round(percent)}%`;
        statusEl.textContent = status;
        substatusEl.textContent = substatus;
        fillEl.style.width = `${percent}%`;
    }

    private async handleFileSelected(file: File): Promise<void> {
        const lower = file.name.toLowerCase();
        if (!lower.endsWith(".3dm") && !lower.endsWith(".glb")) {
            this.showError("Please select a valid 3D model (.3dm or .glb).");
            return;
        }

        if (file.size > 100 * 1024 * 1024) {
            this.showError("File size exceeds maximum allowed limit of 100MB.");
            return;
        }

        this.updateProgress(15, "Uploading CAD file...", `Sending ${file.name} to server`);

        const formData = new FormData();
        formData.append("file", file);

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

        while (!completed && attempts < 60) {
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
                this.updateProgress(95, "Loading 3D ring...", "Preparing WebGi rendering passes");

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
                const hasUnassigned = manifest.components.some((c: any) => c.role === "unassigned");
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

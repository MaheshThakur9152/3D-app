/**
 * ModelInspector.ts
 * Interactive model hierarchy inspector, search filter, component visibility toggles,
 * camera focus tools, transform properties inspector, role assignment dropdowns,
 * and real-time sync with 3D canvas picking.
 */

import { MaterialRoleBinder } from "../cad/MaterialRoleBinder";
import { CanvasPicker, MeshSelectionEvent } from "../cad/CanvasPicker";
import { ModelManifest, ComponentRole, ManifestComponent } from "../cad/ModelManifest";
import { ViewerApp, Box3, Sphere } from "webgi";
import { autoFrameCamera } from "../cad/CameraFraming";

export class ModelInspector {
    private viewer: ViewerApp;
    private roleBinder: MaterialRoleBinder;
    private picker: CanvasPicker;
    private container: HTMLElement;
    private floatingCard: HTMLElement;
    private currentManifest: ModelManifest | null = null;
    private apiBaseUrl: string;
    private activeFilter: string = 'all';
    private searchQuery: string = '';
    private selectedNodeId: string | null = null;

    constructor(
        viewer: ViewerApp,
        roleBinder: MaterialRoleBinder,
        picker: CanvasPicker,
        apiBaseUrl = "http://localhost:5000"
    ) {
        this.viewer = viewer;
        this.roleBinder = roleBinder;
        this.picker = picker;
        this.apiBaseUrl = apiBaseUrl;

        this.container = this.createInspectorElement();
        this.floatingCard = this.createFloatingSelectionCard();

        document.body.appendChild(this.container);
        document.body.appendChild(this.floatingCard);

        this.initPickerListener();
    }

    private createInspectorElement(): HTMLElement {
        const drawer = document.createElement("div");
        drawer.className = "model-inspector-drawer";
        drawer.style.display = "none";
        drawer.innerHTML = `
            <div class="inspector-header">
                <div class="header-titles">
                    <h3>Scene Hierarchy</h3>
                    <span class="components-count-badge">0 Components</span>
                </div>
                <button class="inspector-close-btn" title="Close Panel">&times;</button>
            </div>

            <!-- Selected Component Transform Inspector -->
            <div class="inspector-selection-box" style="display: none;">
                <div class="selection-box-header">
                    <span class="selection-box-title">Selected Component</span>
                    <button class="btn-clear-selection">&times;</button>
                </div>
                <div class="selection-box-name">--</div>
                <div class="selection-box-meta">
                    <span class="badge-layer selection-layer-badge">Default</span>
                    <span class="badge-tris selection-tris-badge">0 tris</span>
                </div>

                <div class="transform-section">
                    <div class="transform-title">Transform Properties</div>
                    <div class="transform-grid">
                        <div class="transform-row">
                            <span class="transform-label">Pos:</span>
                            <span class="transform-val transform-pos">0.0, 0.0, 0.0</span>
                        </div>
                        <div class="transform-row">
                            <span class="transform-label">Rot:</span>
                            <span class="transform-val transform-rot">0°, 0°, 0°</span>
                        </div>
                        <div class="transform-row">
                            <span class="transform-label">Scale:</span>
                            <span class="transform-val transform-scale">1.0, 1.0, 1.0</span>
                        </div>
                    </div>
                </div>

                <div class="selection-actions-row">
                    <button class="btn-action-focus">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="22" y1="12" x2="18" y2="12"/>
                            <line x1="6" y1="12" x2="2" y2="12"/>
                            <line x1="12" y1="6" x2="12" y2="2"/>
                            <line x1="12" y1="22" x2="12" y2="18"/>
                        </svg>
                        <span>Focus View</span>
                    </button>
                    <button class="btn-action-vis">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        <span>Toggle Vis</span>
                    </button>
                </div>
            </div>

            <div class="inspector-search-bar">
                <input type="text" class="inspector-search-input" placeholder="Search by component name or layer..." />
            </div>

            <div class="inspector-filter-pills">
                <button class="pill-btn active" data-filter="all">All</button>
                <button class="pill-btn" data-filter="gems">Gems</button>
                <button class="pill-btn" data-filter="metals">Metals</button>
                <button class="pill-btn" data-filter="unassigned">Unassigned</button>
            </div>

            <div class="inspector-components-list"></div>

            <div class="inspector-footer">
                <button class="btn-save-roles">Save Role Mappings</button>
            </div>
        `;

        drawer.querySelector(".inspector-close-btn")?.addEventListener("click", () => this.hide());
        drawer.querySelector(".btn-save-roles")?.addEventListener("click", () => this.saveRolesToServer());
        drawer.querySelector(".btn-clear-selection")?.addEventListener("click", () => {
            this.picker.clearSelection();
            this.clearSelectionBox();
        });

        const searchInput = drawer.querySelector(".inspector-search-input") as HTMLInputElement;
        searchInput?.addEventListener("input", (e) => {
            this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderComponentsList();
        });

        const filterPills = drawer.querySelectorAll(".pill-btn");
        filterPills.forEach(pill => {
            pill.addEventListener("click", () => {
                filterPills.forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                this.activeFilter = pill.getAttribute("data-filter") || 'all';
                this.renderComponentsList();
            });
        });

        return drawer;
    }

    private createFloatingSelectionCard(): HTMLElement {
        const card = document.createElement("div");
        card.className = "floating-selection-card";
        card.style.display = "none";
        card.innerHTML = `
            <div class="card-header">
                <span class="card-title">Selected Component</span>
                <button class="card-close-btn">&times;</button>
            </div>
            <div class="card-body">
                <div class="card-node-name">--</div>
                <div class="card-meta">
                    <span class="card-layer-badge">Layer</span>
                    <span class="card-tri-badge">0 tris</span>
                </div>
                <div class="card-role-control">
                    <label>Role</label>
                    <select class="card-role-select">
                        <option value="diamond">Center Diamond</option>
                        <option value="accent_stone">Accent / Pavé Diamond</option>
                        <option value="colored_gemstone">Colored Gemstone</option>
                        <option value="metal_shank">Ring Shank (Metal)</option>
                        <option value="metal_head">Head / Setting</option>
                        <option value="metal_prongs">Prongs</option>
                        <option value="unassigned">Unassigned</option>
                    </select>
                </div>
            </div>
        `;

        card.querySelector(".card-close-btn")?.addEventListener("click", () => {
            this.picker.clearSelection();
            this.floatingCard.style.display = "none";
            this.clearSelectionBox();
        });

        return card;
    }

    private initPickerListener(): void {
        this.picker.onSelection((event: MeshSelectionEvent | null) => {
            if (!event || !event.mesh) {
                this.floatingCard.style.display = "none";
                this.clearSelectionBox();
                return;
            }

            const nodeId = this.roleBinder.getNodeIdByMesh(event.mesh);
            const components = this.roleBinder.getComponents();
            const comp = components.find(c => c.nodeId === nodeId || c.nodeName === event.nodeName);

            this.selectedNodeId = comp?.nodeId || null;
            this.updateSelectionBox(event.mesh, comp, event.nodeName);

            // Update floating card
            const titleEl = this.floatingCard.querySelector(".card-node-name") as HTMLElement;
            const layerEl = this.floatingCard.querySelector(".card-layer-badge") as HTMLElement;
            const triEl = this.floatingCard.querySelector(".card-tri-badge") as HTMLElement;
            const selectEl = this.floatingCard.querySelector(".card-role-select") as HTMLSelectElement;

            titleEl.textContent = event.nodeName;
            layerEl.textContent = comp?.sourceLayer || "Default";
            triEl.textContent = `${comp?.geometryStats?.triangleCount || 0} tris`;
            if (comp) selectEl.value = comp.role;

            selectEl.onchange = () => {
                if (comp) {
                    const newRole = selectEl.value as ComponentRole;
                    this.roleBinder.updateRole(comp.nodeId, newRole);
                    this.renderComponentsList();
                }
            };

            this.floatingCard.style.display = "flex";
            this.highlightItemInList(this.selectedNodeId);
        });
    }

    private updateSelectionBox(mesh: any, comp?: ManifestComponent, nodeName?: string): void {
        const box = this.container.querySelector(".inspector-selection-box") as HTMLElement;
        if (!box) return;

        box.style.display = "block";
        const nameEl = box.querySelector(".selection-box-name") as HTMLElement;
        const layerEl = box.querySelector(".selection-layer-badge") as HTMLElement;
        const trisEl = box.querySelector(".selection-tris-badge") as HTMLElement;
        const posEl = box.querySelector(".transform-pos") as HTMLElement;
        const rotEl = box.querySelector(".transform-rot") as HTMLElement;
        const scaleEl = box.querySelector(".transform-scale") as HTMLElement;

        nameEl.textContent = nodeName || comp?.nodeName || mesh.name || "Component";
        layerEl.textContent = comp?.sourceLayer || "Default";
        trisEl.textContent = `${comp?.geometryStats?.triangleCount || 0} tris`;

        // Read transforms
        const p = mesh.position || { x: 0, y: 0, z: 0 };
        const r = mesh.rotation || { x: 0, y: 0, z: 0 };
        const s = mesh.scale || { x: 1, y: 1, z: 1 };

        posEl.textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
        rotEl.textContent = `${((r.x * 180) / Math.PI).toFixed(0)}°, ${((r.y * 180) / Math.PI).toFixed(0)}°, ${((r.z * 180) / Math.PI).toFixed(0)}°`;
        scaleEl.textContent = `${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)}`;

        // Wire Action buttons
        const focusBtn = box.querySelector(".btn-action-focus") as HTMLElement;
        focusBtn.onclick = () => this.focusMesh(mesh);

        const visBtn = box.querySelector(".btn-action-vis") as HTMLElement;
        visBtn.onclick = () => {
            mesh.visible = !mesh.visible;
            this.roleBinder.invalidateRenderingHistory();
            this.renderComponentsList();
        };
    }

    private clearSelectionBox(): void {
        const box = this.container.querySelector(".inspector-selection-box") as HTMLElement;
        if (box) box.style.display = "none";
        this.selectedNodeId = null;
        this.highlightItemInList(null);
    }

    private highlightItemInList(nodeId: string | null): void {
        const items = this.container.querySelectorAll(".inspector-item");
        items.forEach(el => {
            const id = el.getAttribute("data-node-id");
            el.classList.toggle("selected", id === nodeId);
        });
    }

    public focusMesh(mesh: any): void {
        if (!mesh) return;
        this.picker.selectMesh(mesh);

        const camera = this.viewer.scene.activeCamera;
        if (!camera) return;

        try {
            if (mesh.geometry) mesh.geometry.computeBoundingBox();
            const box = new Box3().setFromObject(mesh);
            const sphere = box.getBoundingSphere(new Sphere());
            const radius = Math.max(sphere.radius, 0.2);

            autoFrameCamera(camera, camera.controls, radius * 1.6, true, () => {
                camera.positionUpdated(true);
                camera.targetUpdated(true);
            });
        } catch {
            // Focus fallback
        }
    }

    public show(manifest: ModelManifest): void {
        this.currentManifest = manifest;
        this.container.style.display = "flex";
        this.renderComponentsList();
    }

    public hide(): void {
        this.container.style.display = "none";
    }

    public toggle(): void {
        if (this.container.style.display === "none" || !this.container.style.display) {
            const manifest = this.currentManifest || (this.viewer as any).__currentManifest;
            if (manifest) this.show(manifest);
        } else {
            this.hide();
        }
    }

    private renderComponentsList(): void {
        const listContainer = this.container.querySelector(".inspector-components-list") as HTMLElement;
        const countBadge = this.container.querySelector(".components-count-badge") as HTMLElement;
        listContainer.innerHTML = "";

        const components = this.roleBinder.getComponents();
        countBadge.textContent = `${components.length} Components`;

        const filtered = components.filter(comp => {
            const matchesSearch = comp.nodeName.toLowerCase().includes(this.searchQuery) ||
                (comp.sourceLayer && comp.sourceLayer.toLowerCase().includes(this.searchQuery));

            if (!matchesSearch) return false;

            if (this.activeFilter === 'gems') {
                return comp.role === 'diamond' || comp.role === 'accent_stone' || comp.role === 'colored_gemstone';
            }
            if (this.activeFilter === 'metals') {
                return comp.role === 'metal_shank' || comp.role === 'metal_head' || comp.role === 'metal_prongs';
            }
            if (this.activeFilter === 'unassigned') {
                return comp.role === 'unassigned';
            }
            return true;
        });

        const roleOptions: { value: ComponentRole; label: string }[] = [
            { value: "diamond", label: "Center Diamond" },
            { value: "accent_stone", label: "Accent / Pavé Diamond" },
            { value: "colored_gemstone", label: "Colored Gemstone" },
            { value: "metal_shank", label: "Ring Shank" },
            { value: "metal_head", label: "Head / Setting" },
            { value: "metal_prongs", label: "Prongs" },
            { value: "unassigned", label: "Unassigned" }
        ];

        filtered.forEach(comp => {
            const mesh = this.roleBinder.getMeshByNodeId(comp.nodeId);
            const isVisible = mesh ? mesh.visible : true;
            const isSelected = comp.nodeId === this.selectedNodeId;

            const item = document.createElement("div");
            item.className = `inspector-item ${isSelected ? "selected" : ""}`;
            item.setAttribute("data-node-id", comp.nodeId);
            item.innerHTML = `
                <div class="item-left">
                    <button class="btn-vis-toggle" title="Toggle component visibility">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: ${isVisible ? "1" : "0.25"}">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <div class="item-info">
                        <span class="item-name">${comp.nodeName}</span>
                        <div class="item-meta">
                            <span class="badge-layer">${comp.sourceLayer || "Default"}</span>
                            <span class="badge-tris">${comp.geometryStats?.triangleCount || 0} tris</span>
                        </div>
                    </div>
                </div>
                <div class="item-right">
                    <button class="btn-focus-mesh" title="Select and focus camera in 3D">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="22" y1="12" x2="18" y2="12"/>
                            <line x1="6" y1="12" x2="2" y2="12"/>
                            <line x1="12" y1="6" x2="12" y2="2"/>
                            <line x1="12" y1="22" x2="12" y2="18"/>
                        </svg>
                    </button>
                    <select class="item-role-select">
                        ${roleOptions.map(opt => `
                            <option value="${opt.value}" ${opt.value === comp.role ? "selected" : ""}>
                                ${opt.label}
                            </option>
                        `).join("")}
                    </select>
                </div>
            `;

            // Toggle visibility in 3D
            const visBtn = item.querySelector(".btn-vis-toggle") as HTMLElement;
            visBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (mesh) {
                    mesh.visible = !mesh.visible;
                    const svg = visBtn.querySelector("svg") as HTMLElement;
                    if (svg) svg.style.opacity = mesh.visible ? "1" : "0.25";
                    this.roleBinder.invalidateRenderingHistory();
                }
            });

            // Focus and Select
            const focusBtn = item.querySelector(".btn-focus-mesh") as HTMLElement;
            focusBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (mesh) {
                    this.focusMesh(mesh);
                }
            });

            // Click row to select
            item.addEventListener("click", () => {
                if (mesh) {
                    this.picker.selectMesh(mesh);
                }
            });

            // Role selection
            const roleSelect = item.querySelector(".item-role-select") as HTMLSelectElement;
            roleSelect.addEventListener("change", (e) => {
                e.stopPropagation();
                const newRole = (e.target as HTMLSelectElement).value as ComponentRole;
                this.roleBinder.updateRole(comp.nodeId, newRole);
            });

            listContainer.appendChild(item);
        });
    }

    private async saveRolesToServer(): Promise<void> {
        if (!this.currentManifest || !this.currentManifest.modelId) {
            alert("No custom CAD model is currently loaded to persist roles.");
            return;
        }

        const components = this.roleBinder.getComponents();
        const rolesPayload: Record<string, ComponentRole> = {};
        for (const comp of components) {
            rolesPayload[comp.nodeId] = comp.role;
        }

        const saveBtn = this.container.querySelector(".btn-save-roles") as HTMLButtonElement;
        const originalText = saveBtn.textContent || "Save Role Mappings";
        saveBtn.textContent = "Saving...";
        saveBtn.disabled = true;

        try {
            const res = await fetch(`${this.apiBaseUrl}/api/v1/models/${this.currentManifest.modelId}/roles`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roles: rolesPayload })
            });

            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }

            saveBtn.textContent = "Saved Successfully!";
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 1800);
        } catch (err: any) {
            alert(`Failed to save role mappings: ${err.message}`);
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }
}

/**
 * RoleMappingModal.ts
 * Interactive UI modal allowing designers to review and reassign component roles
 * (e.g., mapping unrecognized CAD layers to metals or gemstones).
 */

import { MaterialRoleBinder } from "../cad/MaterialRoleBinder";
import { ComponentRole, ModelManifest } from "../cad/ModelManifest";

export class RoleMappingModal {
    private container: HTMLElement;
    private roleBinder: MaterialRoleBinder;
    private currentModelId: string | null = null;
    private apiBaseUrl: string;

    constructor(roleBinder: MaterialRoleBinder, apiBaseUrl = "http://localhost:5000") {
        this.roleBinder = roleBinder;
        this.apiBaseUrl = apiBaseUrl;
        this.container = this.createModalElement();
        document.body.appendChild(this.container);
    }

    private createModalElement(): HTMLElement {
        const modal = document.createElement("div");
        modal.className = "role-mapping-modal-overlay";
        modal.style.display = "none";
        modal.innerHTML = `
            <div class="role-mapping-modal">
                <div class="modal-header">
                    <h3>Configure Component Roles</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <p class="modal-subtitle">Assign CAD layers to configurator materials and gemstones.</p>
                <div class="components-table-container">
                    <table class="components-table">
                        <thead>
                            <tr>
                                <th>Component Name</th>
                                <th>CAD Layer</th>
                                <th>Triangles</th>
                                <th>Material Role</th>
                            </tr>
                        </thead>
                        <tbody class="components-tbody"></tbody>
                    </table>
                </div>
                <div class="modal-actions">
                    <button class="btn-cancel">Close</button>
                    <button class="btn-save">Apply Roles</button>
                </div>
            </div>
        `;

        modal.querySelector(".close-btn")?.addEventListener("click", () => this.hide());
        modal.querySelector(".btn-cancel")?.addEventListener("click", () => this.hide());
        modal.querySelector(".btn-save")?.addEventListener("click", () => this.saveRoles());

        return modal;
    }

    public show(manifest: ModelManifest): void {
        this.currentModelId = manifest.modelId;
        const tbody = this.container.querySelector(".components-tbody") as HTMLElement;
        tbody.innerHTML = "";

        const components = this.roleBinder.getComponents();
        const roleOptions: { value: ComponentRole; label: string }[] = [
            { value: "metal_shank", label: "Ring Shank (Metal)" },
            { value: "metal_head", label: "Ring Head / Basket" },
            { value: "metal_prongs", label: "Prongs / Claws" },
            { value: "diamond", label: "Diamond (Brilliant)" },
            { value: "colored_gemstone", label: "Colored Gemstone" },
            { value: "accent_stone", label: "Accent / Pavé Gem" },
            { value: "unassigned", label: "Unassigned" }
        ];

        components.forEach(comp => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${comp.nodeName}</strong></td>
                <td><span class="badge-layer">${comp.sourceLayer || "Default"}</span></td>
                <td>${comp.geometryStats?.triangleCount || 0}</td>
                <td>
                    <select class="role-select" data-node-id="${comp.nodeId}">
                        ${roleOptions.map(opt => `
                            <option value="${opt.value}" ${opt.value === comp.role ? "selected" : ""}>
                                ${opt.label}
                            </option>
                        `).join("")}
                    </select>
                </td>
            `;

            const select = tr.querySelector(".role-select") as HTMLSelectElement;
            select.addEventListener("change", (e) => {
                const target = e.target as HTMLSelectElement;
                const newRole = target.value as ComponentRole;
                this.roleBinder.updateRole(comp.nodeId, newRole);
            });

            tbody.appendChild(tr);
        });

        this.container.style.display = "flex";
    }

    public hide(): void {
        this.container.style.display = "none";
    }

    private async saveRoles(): Promise<void> {
        if (!this.currentModelId) {
            this.hide();
            return;
        }

        const selects = this.container.querySelectorAll(".role-select") as NodeListOf<HTMLSelectElement>;
        const roles: Record<string, string> = {};
        selects.forEach(sel => {
            const nodeId = sel.getAttribute("data-node-id");
            if (nodeId) roles[nodeId] = sel.value;
        });

        try {
            await fetch(`${this.apiBaseUrl}/api/v1/models/${this.currentModelId}/roles`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roles })
            });
        } catch (err) {
            console.warn("Could not persist roles to backend:", err);
        }

        this.hide();
    }
}

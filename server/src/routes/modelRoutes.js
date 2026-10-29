/**
 * modelRoutes.js
 * Endpoints for retrieving model manifests, glTF/GLB assets, role assignments,
 * configurations, and preset libraries with database and filesystem persistence.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');

function createModelRouter({ storageService }) {
    const router = express.Router();

    // GET /api/v1/models - list available models
    router.get('/models', async (req, res) => {
        try {
            if (db.hasDb()) {
                const result = await db.query(
                    `SELECT id, original_filename as "originalFileName", source_format as "sourceFormat",
                            status, source_units as "sourceUnits", source_dimensions as "boundingDimensions",
                            created_at as "createdAt"
                     FROM models
                     ORDER BY created_at DESC`
                );
                return res.json({ models: result.rows });
            }

            // Fallback from storage
            const models = [
                {
                    id: 'builtin-ring-1',
                    originalFileName: 'ring_webgi.glb',
                    sourceFormat: 'glb',
                    status: 'completed',
                    sourceUnits: 'mm'
                },
                {
                    id: 'builtin-ring-2',
                    originalFileName: 'ring2_webgi.glb',
                    sourceFormat: 'glb',
                    status: 'completed',
                    sourceUnits: 'mm'
                }
            ];

            return res.json({ models });
        } catch (err) {
            return res.status(500).json({ error: 'Server Error', message: err.message });
        }
    });

    // GET /api/v1/presets/materials
    router.get('/presets/materials', async (req, res) => {
        try {
            if (db.hasDb()) {
                const result = await db.query(`SELECT id, name, kind, parameters FROM material_presets ORDER BY name ASC`);
                return res.json({ presets: result.rows });
            }
            return res.json({ presets: [] });
        } catch (err) {
            return res.status(500).json({ error: 'Server Error', message: err.message });
        }
    });

    // GET /api/v1/presets/studio
    router.get('/presets/studio', async (req, res) => {
        try {
            if (db.hasDb()) {
                const result = await db.query(`SELECT id, name, background_color as "backgroundColor", ground_settings as "groundSettings", environment_settings as "environmentSettings" FROM studio_presets ORDER BY id ASC`);
                return res.json({ presets: result.rows });
            }
            return res.json({ presets: [] });
        } catch (err) {
            return res.status(500).json({ error: 'Server Error', message: err.message });
        }
    });

    // GET /api/v1/models/:modelId/manifest
    router.get('/models/:modelId/manifest', async (req, res) => {
        try {
            const manifest = await storageService.getManifest(req.params.modelId);
            if (!manifest) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: `Manifest for model '${req.params.modelId}' was not found.`
                });
            }
            return res.json(manifest);
        } catch (err) {
            return res.status(500).json({ error: 'Server Error', message: err.message });
        }
    });

    // GET /api/v1/models/:modelId/model.glb
    router.get('/models/:modelId/model.glb', (req, res) => {
        const glbPath = storageService.getGlbPath(req.params.modelId);
        if (!glbPath) {
            return res.status(404).json({
                error: 'Not Found',
                message: `GLB asset for model '${req.params.modelId}' was not found.`
            });
        }

        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(glbPath);
    });

    // GET /api/v1/models/:modelId/cad
    router.get('/models/:modelId/cad', (req, res) => {
        const cadPath = storageService.getOriginalCadPath(req.params.modelId);
        if (!cadPath) {
            return res.status(404).json({
                error: 'Not Found',
                message: `Original CAD for model '${req.params.modelId}' was not found.`
            });
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.modelId}.3dm"`);
        return res.sendFile(cadPath);
    });

    // PUT /api/v1/models/:modelId/roles
    router.put('/models/:modelId/roles', async (req, res) => {
        try {
            const { roles } = req.body;
            if (!roles || typeof roles !== 'object') {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Payload must contain a "roles" object mapping nodeId to new role.'
                });
            }

            const manifest = await storageService.getManifest(req.params.modelId);
            if (!manifest) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: `Model '${req.params.modelId}' not found.`
                });
            }

            const validRoles = ['metal_shank', 'metal_head', 'metal_prongs', 'diamond', 'colored_gemstone', 'accent_stone', 'unassigned'];
            for (const comp of manifest.components) {
                if (roles[comp.nodeId] && validRoles.includes(roles[comp.nodeId])) {
                    comp.role = roles[comp.nodeId];
                    comp.roleConfidence = 1.0;

                    // Persist to DB if connected
                    if (db.hasDb()) {
                        await db.query(
                            `INSERT INTO component_role_overrides (model_id, node_id, role, updated_at)
                             VALUES ($1, $2, $3, NOW())
                             ON CONFLICT (model_id, node_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
                            [req.params.modelId, comp.nodeId, comp.role]
                        ).catch(() => {});
                    }
                }
            }

            const updated = await storageService.updateManifest(req.params.modelId, manifest);
            return res.json({
                message: 'Roles updated successfully.',
                manifest: updated
            });
        } catch (err) {
            return res.status(500).json({ error: 'Server Error', message: err.message });
        }
    });

    // GET /api/v1/models/:modelId/config
    router.get('/models/:modelId/config', async (req, res) => {
        try {
            if (db.hasDb()) {
                const result = await db.query(
                    `SELECT id, name, version, material_assignments as "materialAssignments",
                            parameter_overrides as "parameterOverrides", studio_preferences as "studioPreferences",
                            updated_at as "updatedAt"
                     FROM ring_configurations
                     WHERE model_id = $1
                     ORDER BY updated_at DESC LIMIT 1`,
                    [req.params.modelId]
                );
                if (result.rows.length > 0) {
                    return res.json({ config: result.rows[0] });
                }
            }

            const configPath = path.join(storageService.processedDir, `${req.params.modelId}.config.json`);
            if (fs.existsSync(configPath)) {
                const data = await fs.promises.readFile(configPath, 'utf-8');
                return res.json({ config: JSON.parse(data) });
            }

            return res.json({ config: null });
        } catch (err) {
            return res.status(500).json({ error: 'Server Error', message: err.message });
        }
    });

    // POST /api/v1/models/:modelId/config
    router.post('/models/:modelId/config', async (req, res) => {
        try {
            const { name, materialAssignments, parameterOverrides, studioPreferences } = req.body;
            const configData = {
                modelId: req.params.modelId,
                name: name || 'Custom Configuration',
                materialAssignments: materialAssignments || {},
                parameterOverrides: parameterOverrides || {},
                studioPreferences: studioPreferences || {},
                updatedAt: new Date().toISOString()
            };

            if (db.hasDb()) {
                await db.query(
                    `INSERT INTO ring_configurations (id, model_id, name, material_assignments, parameter_overrides, studio_preferences, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW())
                     ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        material_assignments = EXCLUDED.material_assignments,
                        parameter_overrides = EXCLUDED.parameter_overrides,
                        studio_preferences = EXCLUDED.studio_preferences,
                        updated_at = NOW()`,
                    [
                        `${req.params.modelId}-config`,
                        req.params.modelId,
                        configData.name,
                        JSON.stringify(configData.materialAssignments),
                        JSON.stringify(configData.parameterOverrides),
                        JSON.stringify(configData.studioPreferences)
                    ]
                ).catch((e) => console.warn('[DB] Config save warning:', e.message));
            }

            // Also save to disk
            const configPath = path.join(storageService.processedDir, `${req.params.modelId}.config.json`);
            await fs.promises.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8');

            return res.json({ message: 'Configuration saved successfully.', config: configData });
        } catch (err) {
            return res.status(500).json({ error: 'Server Error', message: err.message });
        }
    });

    return router;
}

module.exports = {
    createModelRouter
};

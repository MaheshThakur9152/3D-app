/**
 * modelRoutes.js
 * Endpoints for retrieving model manifests, glTF/GLB assets, and updating role assignments.
 */

const express = require('express');

function createModelRouter({ storageService }) {
    const router = express.Router();

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
            const { roles } = req.body; // Map of nodeId -> role
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

            // Update component roles
            const validRoles = ['metal_shank', 'metal_head', 'metal_prongs', 'diamond', 'colored_gemstone', 'accent_stone', 'unassigned'];
            for (const comp of manifest.components) {
                if (roles[comp.nodeId] && validRoles.includes(roles[comp.nodeId])) {
                    comp.role = roles[comp.nodeId];
                    comp.roleConfidence = 1.0; // Manual designer override
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

    return router;
}

module.exports = {
    createModelRouter
};

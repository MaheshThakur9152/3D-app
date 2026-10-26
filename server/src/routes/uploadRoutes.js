/**
 * uploadRoutes.js
 * Endpoints for CAD file upload and conversion job status polling.
 */

const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { isValid3dmSignature, isValidGlbSignature } = require('../converter/rhinoCadConverter');

const upload = multer({
    limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB max
    },
    fileFilter: (req, file, cb) => {
        const lower = file.originalname.toLowerCase();
        if (!lower.endsWith('.3dm') && !lower.endsWith('.glb')) {
            return cb(new Error('Only .3dm (Rhino CAD) and .glb (glTF Binary) files are allowed.'));
        }
        cb(null, true);
    }
});

function createUploadRouter({ jobQueue }) {
    const router = express.Router();

    // POST /api/v1/models/upload
    router.post('/upload', upload.single('file'), (req, res) => {
        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'No .3dm CAD or .glb file provided in multipart field "file".'
                });
            }

            const buffer = req.file.buffer;
            if (!isValid3dmSignature(buffer) && !isValidGlbSignature(buffer)) {
                return res.status(400).json({
                    error: 'Invalid File',
                    message: 'Uploaded file is not a valid Rhino 3DM or glTF GLB document (magic signature mismatch).'
                });
            }

            const modelId = uuidv4();
            const jobId = uuidv4();

            const job = jobQueue.createJob({
                jobId,
                modelId,
                originalFileName: req.file.originalname,
                fileBuffer: buffer
            });

            return res.status(202).json({
                message: 'CAD file accepted for conversion.',
                jobId: job.id,
                modelId: job.modelId,
                status: job.status,
                statusUrl: `/api/v1/jobs/${job.id}`
            });
        } catch (err) {
            console.error('Upload handler error:', err);
            return res.status(500).json({
                error: 'Server Error',
                message: err.message
            });
        }
    });

    // GET /api/v1/jobs/:jobId
    router.get('/jobs/:jobId', (req, res) => {
        const job = jobQueue.getJob(req.params.jobId);
        if (!job) {
            return res.status(404).json({
                error: 'Not Found',
                message: `Conversion job '${req.params.jobId}' does not exist.`
            });
        }

        return res.json({
            jobId: job.id,
            modelId: job.modelId,
            status: job.status,
            progress: job.progress,
            error: job.error,
            result: job.result,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt
        });
    });

    return router;
}

module.exports = {
    createUploadRouter
};

/**
 * server.js
 * Express REST API server for CAD Ingestion & Processing.
 */

const express = require('express');
const cors = require('cors');
const config = require('./config');
const { StorageService } = require('./services/storageService');
const { RhinoCadConverter } = require('./converter/rhinoCadConverter');
const { JobQueue } = require('./queue/jobQueue');
const { createUploadRouter } = require('./routes/uploadRoutes');
const { createModelRouter } = require('./routes/modelRoutes');

function createApp() {
    const app = express();

    app.use(cors({ origin: config.corsOrigin }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const storageService = new StorageService(config.storageDir);
    const converter = new RhinoCadConverter();
    const jobQueue = new JobQueue({
        converter,
        storageService,
        concurrency: config.queueConcurrency
    });

    // Health check
    app.get('/api/v1/health', (req, res) => {
        res.json({
            status: 'ok',
            service: '3d-cad-import-service',
            timestamp: new Date().toISOString(),
            storageDir: config.storageDir
        });
    });

    // Mount routers
    app.use('/api/v1', createUploadRouter({ jobQueue }));
    app.use('/api/v1', createModelRouter({ storageService }));

    // Global error handler
    app.use((err, req, res, next) => {
        console.error('Unhandled server error:', err);
        res.status(err.status || 500).json({
            error: err.name || 'ServerError',
            message: err.message || 'An unexpected error occurred.'
        });
    });

    return { app, storageService, jobQueue, converter };
}

// Start standalone if executed directly
if (require.main === module) {
    const { app } = createApp();
    app.listen(config.port, () => {
        console.log(`[CAD-Import-Service] Listening on http://localhost:${config.port}`);
        console.log(`[CAD-Import-Service] Storage directory: ${config.storageDir}`);
    });
}

module.exports = {
    createApp
};

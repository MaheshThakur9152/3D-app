/**
 * server.js
 * Express REST API server for CAD Ingestion & Processing.
 */

const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');
const { runMigrations } = require('./db/migrate');
const { StorageService } = require('./services/storageService');
const { RhinoCadConverter } = require('./converter/rhinoCadConverter');
const { JobQueue } = require('./queue/jobQueue');
const { createUploadRouter } = require('./routes/uploadRoutes');
const { createModelRouter } = require('./routes/modelRoutes');

function createApp() {
    const app = express();

    app.use(cors({ origin: config.corsOrigin }));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    const storageService = new StorageService(config.storageDir);
    const converter = new RhinoCadConverter();
    const jobQueue = new JobQueue({
        converter,
        storageService,
        concurrency: config.queueConcurrency
    });

    // Health check
    app.get('/api/v1/health', async (req, res) => {
        const dbHealthy = db.hasDb();
        res.json({
            status: 'ok',
            service: 'mahesh-3d-cad-service',
            timestamp: new Date().toISOString(),
            storageDir: config.storageDir,
            database: dbHealthy ? 'connected' : 'standalone',
            queue: jobQueue.bullQueue ? 'redis-bullmq' : 'in-memory'
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
    (async () => {
        // Run DB migrations if database is configured
        try {
            await db.testConnection();
            if (db.hasDb()) {
                await runMigrations();
            }
        } catch (e) {
            console.warn('[Startup] Database migration skipped or failed:', e.message);
        }

        const { app } = createApp();
        app.listen(config.port, () => {
            console.log(`[Mahesh3D-API] Listening on http://localhost:${config.port}`);
            console.log(`[Mahesh3D-API] Storage directory: ${config.storageDir}`);
        });
    })();
}

module.exports = {
    createApp
};

/**
 * worker.js
 * BullMQ Background Worker for Rhino CAD conversions and glTF processing.
 */

const { Worker } = require('bullmq');
const Redis = require('ioredis');
const config = require('./config');
const { StorageService } = require('./services/storageService');
const { RhinoCadConverter } = require('./converter/rhinoCadConverter');
const db = require('./db');

async function startWorker() {
    console.log('[Worker] Initializing background CAD worker...');

    const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);
    if (!redisUrl) {
        console.warn('[Worker] No REDIS_URL provided; background worker waiting or running in local mode.');
    }

    const storageService = new StorageService(config.storageDir);
    const converter = new RhinoCadConverter();

    await db.testConnection();

    if (!redisUrl) {
        console.log('[Worker] Standalone mode: keeping alive.');
        setInterval(() => {}, 10000);
        return;
    }

    const redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    });

    const worker = new Worker('cad-conversions', async (job) => {
        const { jobId, modelId, originalFileName, options } = job.data;
        console.log(`[Worker] Processing job ${jobId} for model ${modelId} (${originalFileName})`);

        // Read original file from storage
        const filePath = storageService.getOriginalCadPath(modelId);
        if (!filePath) {
            throw new Error(`Original file not found for model ${modelId}`);
        }

        const fs = require('fs');
        const fileBuffer = await fs.promises.readFile(filePath);

        // Update progress in DB
        await db.query(
            `UPDATE conversion_jobs SET status = 'processing', progress = 30, current_stage = 'converting', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [jobId]
        ).catch(() => {});

        // Convert
        const conversionResult = await converter.convert(fileBuffer, {
            modelId,
            originalFileName,
            ...(options || {})
        });

        // Save processed GLB and manifest
        await storageService.saveProcessedAssets(
            modelId,
            conversionResult.glbBuffer,
            conversionResult.manifest
        );

        // Update completed
        await db.query(
            `UPDATE conversion_jobs SET status = 'completed', progress = 100, current_stage = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [jobId]
        ).catch(() => {});

        await db.query(
            `UPDATE models SET status = 'completed', processed_asset_path = $1, manifest_path = $2, source_dimensions = $3, updated_at = NOW() WHERE id = $4`,
            [`processed/${modelId}.glb`, `processed/${modelId}.manifest.json`, JSON.stringify(conversionResult.manifest.boundingDimensions), modelId]
        ).catch(() => {});

        console.log(`[Worker] Successfully completed conversion for model ${modelId}`);
        return {
            modelId,
            warnings: conversionResult.warnings,
            componentsCount: conversionResult.manifest.components.length
        };
    }, {
        connection: redisConnection,
        concurrency: config.queueConcurrency || 2
    });

    worker.on('failed', async (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err.message);
        if (job?.data?.jobId) {
            await db.query(
                `UPDATE conversion_jobs SET status = 'failed', progress = 100, current_stage = 'failed', error_message = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
                [err.message, job.data.jobId]
            ).catch(() => {});
            if (job.data.modelId) {
                await db.query(
                    `UPDATE models SET status = 'failed', updated_at = NOW() WHERE id = $1`,
                    [job.data.modelId]
                ).catch(() => {});
            }
        }
    });

    console.log('[Worker] Background worker listening on cad-conversions queue.');
}

if (require.main === module) {
    startWorker().catch((err) => {
        console.error('[Worker] Fatal startup error:', err);
        process.exit(1);
    });
}

module.exports = {
    startWorker
};

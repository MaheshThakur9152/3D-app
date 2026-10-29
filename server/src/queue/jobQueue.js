/**
 * jobQueue.js
 * Asynchronous job queue supporting both BullMQ (Redis) and In-Memory fallback.
 * Tracks progress, failure handling, retries, and persistence across database and storage.
 */

const { EventEmitter } = require('events');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const db = require('../db');

class JobQueue extends EventEmitter {
    constructor({ converter, storageService, concurrency = 2 }) {
        super();
        this.converter = converter;
        this.storageService = storageService;
        this.concurrency = concurrency;

        this.jobs = new Map();
        this.memoryQueue = [];
        this.activeCount = 0;

        this.redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);
        this.bullQueue = null;

        if (this.redisUrl) {
            try {
                this.redisConnection = new Redis(this.redisUrl, {
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false
                });
                this.bullQueue = new Queue('cad-conversions', { connection: this.redisConnection });
                console.log('[Queue] BullMQ connected to Redis at', this.redisUrl);
            } catch (err) {
                console.warn('[Queue] Failed to connect to Redis; falling back to in-memory queue:', err.message);
                this.bullQueue = null;
            }
        }
    }

    async createJob({ jobId, modelId, originalFileName, fileBuffer, options = {} }) {
        const job = {
            id: jobId,
            modelId,
            originalFileName,
            options,
            status: 'queued',
            progress: 0,
            stage: 'queued',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            error: null,
            result: null,
            retries: 0,
            maxRetries: 1
        };

        this.jobs.set(jobId, job);

        // Always save original CAD file immediately to shared storage
        await this.storageService.saveOriginalCad(job.modelId, job.originalFileName, fileBuffer);

        // Record in DB if active
        await this._recordJobInDb(job, fileBuffer.length).catch((e) => console.warn('[Queue] DB record error:', e.message));

        if (this.bullQueue) {
            try {
                await this.bullQueue.add('convert', {
                    jobId,
                    modelId,
                    originalFileName,
                    options
                }, {
                    jobId,
                    removeOnComplete: false,
                    removeOnFail: false
                });
            } catch (err) {
                console.warn('[Queue] BullMQ add error; using in-memory queue:', err.message);
                this.memoryQueue.push({ job, fileBuffer, options });
                process.nextTick(() => this._processNextMemory());
            }
        } else {
            this.memoryQueue.push({ job, fileBuffer, options });
            process.nextTick(() => this._processNextMemory());
        }

        this.emit('jobCreated', job);
        return job;
    }

    async getJob(jobId) {
        if (db.hasDb()) {
            try {
                const res = await db.query(
                    `SELECT c.id, c.model_id, c.status, c.progress, c.current_stage as stage, c.error_message as error,
                            c.created_at as "createdAt", c.updated_at as "updatedAt",
                            m.processed_asset_path, m.manifest_path, m.source_dimensions
                     FROM conversion_jobs c
                     LEFT JOIN models m ON m.id = c.model_id
                     WHERE c.id = $1`,
                    [jobId]
                );
                if (res && res.rows && res.rows.length > 0) {
                    const row = res.rows[0];
                    return {
                        id: row.id,
                        modelId: row.model_id,
                        status: row.status,
                        progress: row.progress,
                        stage: row.stage,
                        error: row.error,
                        createdAt: row.createdAt,
                        updatedAt: row.updatedAt,
                        result: row.status === 'completed' ? {
                            modelId: row.model_id,
                            glbUrl: `/api/v1/models/${row.model_id}/model.glb`,
                            manifestUrl: `/api/v1/models/${row.model_id}/manifest`,
                            dimensions: row.source_dimensions
                        } : null
                    };
                }
            } catch {
                // Fallback to memory
            }
        }
        return this.jobs.get(jobId) || null;
    }

    updateJobStatus(jobId, update) {
        const job = this.jobs.get(jobId);
        if (!job) return null;
        Object.assign(job, update, { updatedAt: new Date().toISOString() });
        this._updateJobInDb(job).catch(() => {});
        return job;
    }

    async _recordJobInDb(job, size) {
        try {
            const ext = (job.originalFileName || '').split('.').pop().toLowerCase();
            await db.query(
                `INSERT INTO models (id, original_filename, source_format, original_asset_path, status, source_units)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET updated_at = NOW(), status = EXCLUDED.status`,
                [job.modelId, job.originalFileName, ext, `uploads/${job.modelId}.${ext}`, 'queued', job.options?.sourceUnit || 'mm']
            );

            await db.query(
                `INSERT INTO conversion_jobs (id, model_id, status, progress, current_stage)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET updated_at = NOW(), status = EXCLUDED.status, progress = EXCLUDED.progress`,
                [job.id, job.modelId, job.status, job.progress, job.stage || 'queued']
            );
        } catch {
            // Safe fallback
        }
    }

    async _updateJobInDb(job) {
        try {
            await db.query(
                `UPDATE conversion_jobs
                 SET status = $1, progress = $2, current_stage = $3, error_message = $4, updated_at = NOW(),
                     started_at = CASE WHEN $1 = 'processing' AND started_at IS NULL THEN NOW() ELSE started_at END,
                     completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
                 WHERE id = $5`,
                [job.status, job.progress, job.stage || job.status, job.error, job.id]
            );

            if (job.status === 'completed') {
                await db.query(
                    `UPDATE models
                     SET status = 'completed',
                         processed_asset_path = $1,
                         manifest_path = $2,
                         source_dimensions = $3,
                         updated_at = NOW()
                     WHERE id = $4`,
                    [
                        `processed/${job.modelId}.glb`,
                        `processed/${job.modelId}.manifest.json`,
                        JSON.stringify(job.result?.dimensions || {}),
                        job.modelId
                    ]
                );
            } else if (job.status === 'failed') {
                await db.query(
                    `UPDATE models SET status = 'failed', updated_at = NOW() WHERE id = $1`,
                    [job.modelId]
                );
            }
        } catch {
            // Safe fallback
        }
    }

    async _processNextMemory() {
        if (this.activeCount >= this.concurrency || this.memoryQueue.length === 0) {
            return;
        }

        const item = this.memoryQueue.shift();
        if (!item) return;

        const { job, fileBuffer, options } = item;
        this.activeCount++;

        job.status = 'processing';
        job.stage = 'inspecting';
        job.progress = 20;
        job.updatedAt = new Date().toISOString();
        this.emit('jobProcessing', job);
        this._updateJobInDb(job).catch(() => {});

        try {
            job.stage = 'converting';
            job.progress = 40;
            this._updateJobInDb(job).catch(() => {});

            // Execute CAD conversion
            const conversionResult = await this.converter.convert(fileBuffer, {
                modelId: job.modelId,
                originalFileName: job.originalFileName,
                ...(options || {})
            });
            job.stage = 'optimizing';
            job.progress = 80;
            this._updateJobInDb(job).catch(() => {});

            // Save processed GLB and Manifest
            await this.storageService.saveProcessedAssets(
                job.modelId,
                conversionResult.glbBuffer,
                conversionResult.manifest
            );

            job.status = 'completed';
            job.stage = 'completed';
            job.progress = 100;
            job.updatedAt = new Date().toISOString();
            job.result = {
                modelId: job.modelId,
                manifestUrl: `/api/v1/models/${job.modelId}/manifest`,
                glbUrl: `/api/v1/models/${job.modelId}/model.glb`,
                warnings: conversionResult.warnings,
                componentsCount: conversionResult.manifest.components.length,
                dimensions: conversionResult.manifest.boundingDimensions
            };

            this.emit('jobCompleted', job);
            this._updateJobInDb(job).catch(() => {});
        } catch (err) {
            console.error(`Conversion failed for job ${job.id}:`, err.message);

            if (job.retries < job.maxRetries) {
                job.retries++;
                job.status = 'retrying';
                job.stage = 'retrying';
                job.progress = 10;
                job.updatedAt = new Date().toISOString();
                this.memoryQueue.unshift(item);
                this.emit('jobRetrying', job);
            } else {
                job.status = 'failed';
                job.stage = 'failed';
                job.progress = 100;
                job.error = err.message || 'CAD conversion failed';
                job.updatedAt = new Date().toISOString();
                this.emit('jobFailed', job);
            }
            this._updateJobInDb(job).catch(() => {});
        } finally {
            this.activeCount--;
            process.nextTick(() => this._processNextMemory());
        }
    }
}

module.exports = {
    JobQueue
};

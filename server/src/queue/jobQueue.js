/**
 * jobQueue.js
 * Asynchronous job queue for CAD conversion.
 * Tracks progress, failure handling, retries, and persistence.
 */

const { EventEmitter } = require('events');

class JobQueue extends EventEmitter {
    constructor({ converter, storageService, concurrency = 2 }) {
        super();
        this.converter = converter;
        this.storageService = storageService;
        this.concurrency = concurrency;

        this.jobs = new Map();
        this.queue = [];
        this.activeCount = 0;
    }

    createJob({ jobId, modelId, originalFileName, fileBuffer }) {
        const job = {
            id: jobId,
            modelId,
            originalFileName,
            status: 'queued',
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            error: null,
            result: null,
            retries: 0,
            maxRetries: 1
        };

        this.jobs.set(jobId, job);
        this.queue.push({ job, fileBuffer });
        this.emit('jobCreated', job);

        process.nextTick(() => this._processNext());
        return job;
    }

    getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }

    async _processNext() {
        if (this.activeCount >= this.concurrency || this.queue.length === 0) {
            return;
        }

        const item = this.queue.shift();
        if (!item) return;

        const { job, fileBuffer } = item;
        this.activeCount++;

        job.status = 'processing';
        job.progress = 20;
        job.updatedAt = new Date().toISOString();
        this.emit('jobProcessing', job);

        try {
            // Save original CAD (immutable)
            await this.storageService.saveOriginalCad(job.modelId, job.originalFileName, fileBuffer);
            job.progress = 40;

            // Execute CAD conversion
            const conversionResult = await this.converter.convert(fileBuffer, {
                modelId: job.modelId,
                originalFileName: job.originalFileName
            });
            job.progress = 80;

            // Save processed GLB and Manifest
            await this.storageService.saveProcessedAssets(
                job.modelId,
                conversionResult.glbBuffer,
                conversionResult.manifest
            );

            job.status = 'completed';
            job.progress = 100;
            job.updatedAt = new Date().toISOString();
            job.result = {
                modelId: job.modelId,
                manifestUrl: `/api/v1/models/${job.modelId}/manifest`,
                glbUrl: `/api/v1/models/${job.modelId}/model.glb`,
                warnings: conversionResult.warnings,
                componentsCount: conversionResult.manifest.components.length
            };

            this.emit('jobCompleted', job);
        } catch (err) {
            console.error(`Conversion failed for job ${job.id}:`, err.message);

            if (job.retries < job.maxRetries) {
                job.retries++;
                job.status = 'retrying';
                job.progress = 10;
                job.updatedAt = new Date().toISOString();
                this.queue.unshift(item); // Push back to front
                this.emit('jobRetrying', job);
            } else {
                job.status = 'failed';
                job.progress = 100;
                job.error = err.message || 'CAD conversion failed';
                job.updatedAt = new Date().toISOString();
                this.emit('jobFailed', job);
            }
        } finally {
            this.activeCount--;
            process.nextTick(() => this._processNext());
        }
    }
}

module.exports = {
    JobQueue
};

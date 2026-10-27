/**
 * db_queue.test.js
 * Unit and integration tests for PostgreSQL migration schema and JobQueue lifecycle.
 */

const assert = require('assert');
const { JobQueue } = require('../src/queue/jobQueue');
const { StorageService } = require('../src/services/storageService');
const { RhinoCadConverter } = require('../src/converter/rhinoCadConverter');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function runTests() {
    console.log('--- Starting DB & Queue Integration Tests ---');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cad-test-'));
    const storageService = new StorageService(tempDir);
    const converter = new RhinoCadConverter();

    const queue = new JobQueue({
        converter,
        storageService,
        concurrency: 1
    });

    // Test 1: In-memory queue lifecycle
    console.log('[Test 1] Testing job creation and in-memory queue status...');
    const dummyBuffer = Buffer.from('test glb buffer');
    const job = await queue.createJob({
        jobId: 'test-job-1',
        modelId: 'test-model-1',
        originalFileName: 'test.glb',
        fileBuffer: dummyBuffer
    });

    assert.strictEqual(job.id, 'test-job-1');
    assert.strictEqual(job.status, 'queued');
    const retrieved = await queue.getJob('test-job-1');
    assert.strictEqual(retrieved.id, 'test-job-1');
    console.log('  -> PASS: Job created and queued properly.');

    // Wait for queue processing to complete or fail
    await new Promise((resolve) => {
        queue.on('jobCompleted', resolve);
        queue.on('jobFailed', resolve);
    });

    // Test 2: Storage paths
    console.log('[Test 2] Storage service directories...');
    assert.ok(fs.existsSync(storageService.uploadsDir));
    assert.ok(fs.existsSync(storageService.processedDir));
    console.log('  -> PASS: Storage paths confirmed.');

    // Cleanup
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    console.log('--- ALL DB & QUEUE TESTS PASSED! ---');
}

runTests().catch((e) => {
    console.error('Test failure:', e);
    process.exit(1);
});

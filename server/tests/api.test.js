/**
 * api.test.js
 * End-to-end integration tests for backend API, file upload, job lifecycle, and asset delivery.
 */

const assert = require('assert');
const http = require('http');
const { createApp } = require('../src/server');
const { createTestRing3dm } = require('./generateTestRing');

function request(app, options, body = null) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            const reqOptions = {
                hostname: '127.0.0.1',
                port,
                path: options.path,
                method: options.method || 'GET',
                headers: options.headers || {}
            };

            const req = http.request(reqOptions, (res) => {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    server.close();
                    const raw = Buffer.concat(chunks);
                    let json = null;
                    try {
                        json = JSON.parse(raw.toString('utf-8'));
                    } catch (_) {}
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: json || raw
                    });
                });
            });

            req.on('error', (err) => {
                server.close();
                reject(err);
            });

            if (body) {
                req.write(body);
            }
            req.end();
        });
    });
}

function buildMultipartFormData(boundary, fieldName, filename, fileBuffer) {
    const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    return Buffer.concat([header, fileBuffer, footer]);
}

async function runApiTests() {
    console.log('--- Starting API & Job Lifecycle Integration Tests ---');
    const { app, jobQueue } = createApp();

    // 1. Health check
    console.log('[Test 1] Testing /api/v1/health...');
    const health = await request(app, { path: '/api/v1/health' });
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'ok');

    // 2. Upload invalid file
    console.log('[Test 2] Testing upload invalid file...');
    const badBoundary = '----WebKitFormBoundaryXYZ';
    const badBody = buildMultipartFormData(badBoundary, 'file', 'fake.3dm', Buffer.from('corrupt junk'));
    const badUpload = await request(app, {
        path: '/api/v1/upload',
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${badBoundary}`,
            'Content-Length': badBody.length
        }
    }, badBody);
    assert.strictEqual(badUpload.status, 400);

    // 3. Upload real test ring 3DM
    console.log('[Test 3] Uploading real .3dm ring model...');
    const ring3dm = await createTestRing3dm();
    const boundary = '----WebKitFormBoundaryABC123';
    const multipartBody = buildMultipartFormData(boundary, 'file', 'test_solitaire.3dm', ring3dm);

    const uploadRes = await request(app, {
        path: '/api/v1/upload',
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': multipartBody.length
        }
    }, multipartBody);

    assert.strictEqual(uploadRes.status, 202);
    assert.ok(uploadRes.body.jobId, 'Should return jobId');
    assert.ok(uploadRes.body.modelId, 'Should return modelId');
    const { jobId, modelId } = uploadRes.body;

    // 4. Poll job status until completed
    console.log('[Test 4] Polling job status until completion...');
    let job = null;
    for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(r => setTimeout(r, 200));
        const statusRes = await request(app, { path: `/api/v1/jobs/${jobId}` });
        assert.strictEqual(statusRes.status, 200);
        job = statusRes.body;
        if (job.status === 'completed' || job.status === 'failed') {
            break;
        }
    }

    assert.strictEqual(job.status, 'completed', `Job should complete successfully, error: ${job.error}`);
    assert.strictEqual(job.progress, 100);
    assert.ok(job.result.manifestUrl);
    assert.ok(job.result.glbUrl);

    // 5. Fetch manifest
    console.log('[Test 5] Fetching generated model manifest...');
    const manifestRes = await request(app, { path: `/api/v1/models/${modelId}/manifest` });
    assert.strictEqual(manifestRes.status, 200);
    const manifest = manifestRes.body;
    assert.strictEqual(manifest.modelId, modelId);
    assert.strictEqual(manifest.components.length, 2);

    // 6. Fetch GLB asset
    console.log('[Test 6] Fetching generated GLB asset...');
    const glbRes = await request(app, { path: `/api/v1/models/${modelId}/model.glb` });
    assert.strictEqual(glbRes.status, 200);
    assert.strictEqual(glbRes.headers['content-type'], 'model/gltf-binary');
    const magic = glbRes.body.slice(0, 4).toString('ascii');
    assert.strictEqual(magic, 'glTF');

    // 7. Update component roles
    console.log('[Test 7] Updating component role mapping via PUT /roles...');
    const diamondComp = manifest.components.find(c => c.role === 'diamond');
    const roleUpdatePayload = JSON.stringify({
        roles: {
            [diamondComp.nodeId]: 'colored_gemstone'
        }
    });

    const updateRes = await request(app, {
        path: `/api/v1/models/${modelId}/roles`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(roleUpdatePayload)
        }
    }, Buffer.from(roleUpdatePayload));

    assert.strictEqual(updateRes.status, 200);
    const updatedComp = updateRes.body.manifest.components.find(c => c.nodeId === diamondComp.nodeId);
    assert.strictEqual(updatedComp.role, 'colored_gemstone');

    // 8. Upload GLB file
    console.log('[Test 8] Uploading real .glb model...');
    const fs = require('fs');
    const path = require('path');
    const glbSample = fs.readFileSync(path.resolve(__dirname, '../../rendering/assets/ring_webgi.glb'));
    const glbBoundary = '----WebKitFormBoundaryGLB123';
    const glbMultipart = buildMultipartFormData(glbBoundary, 'file', 'custom_ring.glb', glbSample);

    const glbUploadRes = await request(app, {
        path: '/api/v1/upload',
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${glbBoundary}`,
            'Content-Length': glbMultipart.length
        }
    }, glbMultipart);

    assert.strictEqual(glbUploadRes.status, 202);
    const glbJobId = glbUploadRes.body.jobId;

    let glbJob = null;
    for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(r => setTimeout(r, 100));
        const statusRes = await request(app, { path: `/api/v1/jobs/${glbJobId}` });
        glbJob = statusRes.body;
        if (glbJob.status === 'completed' || glbJob.status === 'failed') break;
    }
    assert.strictEqual(glbJob.status, 'completed');
    assert.ok(glbJob.result.manifestUrl);

    console.log('--- ALL API & JOB LIFECYCLE TESTS PASSED SUCCESSFULLY! ---\n');
}

runApiTests().catch(err => {
    console.error('API test failed:', err);
    process.exit(1);
});

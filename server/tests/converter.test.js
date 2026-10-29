/**
 * converter.test.js
 * Automated unit tests for Rhino CAD converter, role heuristics, facet normals, and GLB generation.
 */

const assert = require('assert');
const { RhinoCadConverter, isValid3dmSignature, classifyRole } = require('../src/converter/rhinoCadConverter');
const { createTestRing3dm } = require('./generateTestRing');

async function runTests() {
    console.log('--- Starting CAD Converter Unit Tests ---');

    // Test 1: Signature validation
    console.log('[Test 1] Testing 3DM signature validation...');
    assert.strictEqual(isValid3dmSignature(Buffer.from('not a rhino file')), false);
    assert.strictEqual(isValid3dmSignature(null), false);

    // Test 2: Heuristic role classifier
    console.log('[Test 2] Testing role classification heuristics...');
    const r1 = classifyRole('Main_Shank', 'SHANK::METAL', 500);
    assert.strictEqual(r1.role, 'metal_shank');

    const r2 = classifyRole('Center_Stone', 'GEM::DIAMOND', 114);
    assert.strictEqual(r2.role, 'diamond');

    const r3 = classifyRole('Prongs_Head', 'PRONGS', 200);
    assert.strictEqual(r3.role, 'metal_prongs');

    const r4 = classifyRole('Halo_Stone_1', 'ACCENT_GEMS', 50);
    assert.strictEqual(r4.role, 'accent_stone');

    const r5 = classifyRole('UnknownObj', 'Default', 300);
    assert.strictEqual(r5.role, 'unassigned');

    // Test 3: Generate real test ring .3dm
    console.log('[Test 3] Generating real test ring 3DM buffer...');
    const ringBuffer = await createTestRing3dm();
    assert.ok(ringBuffer.length > 1000, '3DM buffer should be non-empty');
    assert.strictEqual(isValid3dmSignature(ringBuffer), true, 'Generated buffer should pass 3DM signature check');

    // Test 4: Conversion execution
    console.log('[Test 4] Running RhinoCadConverter.convert()...');
    const converter = new RhinoCadConverter();
    const result = await converter.convert(ringBuffer, {
        modelId: 'test-model-123',
        originalFileName: 'test_ring.3dm'
    });

    assert.ok(result.glbBuffer, 'GLB buffer should be generated');
    assert.ok(result.manifest, 'Manifest should be generated');

    // Verify manifest contents
    const m = result.manifest;
    console.log('[Test 5] Verifying manifest structure...');
    assert.strictEqual(m.schemaVersion, '1.0.0');
    assert.strictEqual(m.modelId, 'test-model-123');
    assert.strictEqual(m.originalFileName, 'test_ring.3dm');
    assert.ok(m.boundingDimensions.width > 0);
    assert.ok(m.boundingDimensions.height > 0);
    assert.strictEqual(m.components.length, 2);

    const shank = m.components.find(c => c.nodeName === 'Ring_Shank_Solid');
    assert.ok(shank, 'Shank component must exist');
    assert.strictEqual(shank.role, 'metal_shank');
    assert.strictEqual(shank.geometryStats.facetNormalsPreserved, false);

    const diamond = m.components.find(c => c.nodeName === 'Center_Diamond_Brilliant');
    assert.ok(diamond, 'Diamond component must exist');
    assert.strictEqual(diamond.role, 'diamond');
    assert.strictEqual(diamond.geometryStats.facetNormalsPreserved, true);

    // Verify GLB binary structure
    console.log('[Test 6] Verifying generated GLB binary...');
    const glb = result.glbBuffer;
    const magic = glb.slice(0, 4).toString('ascii');
    const version = glb.readUInt32LE(4);
    const totalLength = glb.readUInt32LE(8);
    assert.strictEqual(magic, 'glTF');
    assert.strictEqual(version, 2);
    assert.strictEqual(totalLength, glb.length);

    // Test 7: Direct GLB Ingestion
    console.log('[Test 7] Ingesting native .glb file...');
    const fs = require('fs');
    const path = require('path');
    const glbSamplePath = path.resolve(__dirname, '../../rendering/assets/ring_webgi.glb');
    const glbSample = fs.readFileSync(glbSamplePath);
    const glbResult = await converter.convert(glbSample, {
        modelId: 'glb-test-456',
        originalFileName: 'ring_webgi.glb'
    });
    assert.ok(glbResult.glbBuffer, 'GLB buffer should be returned');
    assert.ok(glbResult.manifest, 'Manifest should be generated from GLB');
    assert.strictEqual(glbResult.manifest.modelId, 'glb-test-456');
    assert.ok(glbResult.manifest.components.length > 0, 'GLB components should be detected');
    const hasDiamonds = glbResult.manifest.components.some(c => c.role === 'diamond');
    assert.strictEqual(hasDiamonds, true, 'Diamonds in GLB should be classified as diamond role');

    console.log('--- ALL CAD CONVERTER UNIT TESTS PASSED SUCCESSFULLY! ---\n');
}

runTests().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});

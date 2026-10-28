/**
 * glbBuilder.js
 * Generates a valid glTF 2.0 Binary (.glb) asset from processed component meshes.
 * Injects WEBGI_materials_diamond extension for gemstone nodes.
 */

function buildGLB(components, metadata = {}) {
    const bufferViews = [];
    const accessors = [];
    const gltfMeshes = [];
    const gltfNodes = [];
    const binaryChunks = [];

    let byteOffset = 0;

    for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        const posBuffer = Buffer.from(comp.positions.buffer, comp.positions.byteOffset, comp.positions.byteLength);
        const normBuffer = Buffer.from(comp.normals.buffer, comp.normals.byteOffset, comp.normals.byteLength);
        const indBuffer = Buffer.from(comp.indices.buffer, comp.indices.byteOffset, comp.indices.byteLength);

        // Position bufferView
        const posViewIdx = bufferViews.length;
        bufferViews.push({ buffer: 0, byteOffset, byteLength: posBuffer.length, target: 34962 });
        binaryChunks.push(posBuffer);
        byteOffset += posBuffer.length;

        // Normal bufferView
        const normViewIdx = bufferViews.length;
        bufferViews.push({ buffer: 0, byteOffset, byteLength: normBuffer.length, target: 34962 });
        binaryChunks.push(normBuffer);
        byteOffset += normBuffer.length;

        // Index bufferView
        const indViewIdx = bufferViews.length;
        bufferViews.push({ buffer: 0, byteOffset, byteLength: indBuffer.length, target: 34963 });
        binaryChunks.push(indBuffer);
        byteOffset += indBuffer.length;

        // Accessors
        const posAccIdx = accessors.length;
        accessors.push({
            bufferView: posViewIdx,
            byteOffset: 0,
            componentType: 5126, // FLOAT
            count: comp.positions.length / 3,
            type: 'VEC3',
            min: comp.posMin,
            max: comp.posMax
        });

        const normAccIdx = accessors.length;
        accessors.push({
            bufferView: normViewIdx,
            byteOffset: 0,
            componentType: 5126, // FLOAT
            count: comp.normals.length / 3,
            type: 'VEC3'
        });

        const indAccIdx = accessors.length;
        accessors.push({
            bufferView: indViewIdx,
            byteOffset: 0,
            componentType: comp.indices instanceof Uint32Array ? 5125 : 5123,
            count: comp.indices.length,
            type: 'SCALAR'
        });

        gltfMeshes.push({
            name: comp.nodeName || comp.name || `mesh_${i}`,
            primitives: [{
                attributes: { POSITION: posAccIdx, NORMAL: normAccIdx },
                indices: indAccIdx,
                material: i
            }]
        });

        gltfNodes.push({
            name: comp.nodeName || comp.name || `node_${i}`,
            mesh: i
        });
    }

    const binaryBuffer = Buffer.concat(binaryChunks);
    const pad = (4 - (binaryBuffer.length % 4)) % 4;
    const paddedBinaryBuffer = pad > 0 ? Buffer.concat([binaryBuffer, Buffer.alloc(pad)]) : binaryBuffer;

    const materials = components.map((comp) => {
        const isDiamond = comp.role === 'diamond' || comp.role === 'colored_gemstone' || comp.role === 'accent_stone';
        if (isDiamond) {
            return {
                name: comp.nodeName || 'diamond',
                pbrMetallicRoughness: {
                    baseColorFactor: [0.95, 0.95, 1.0, 1.0],
                    metallicFactor: 0.0,
                    roughnessFactor: 0.0
                },
                extensions: {
                    WEBGI_materials_diamond: {
                        name: 'diamond',
                        type: 'DiamondMaterial',
                        isDiamond: true,
                        isDiamondMaterial: true,
                        isDiamondMaterialParameters: true,
                        refractiveIndex: 2.417,
                        dispersion: 0.012,
                        reflectivity: 0.5,
                        rayBounces: 5,
                        geometryFactor: 0.5,
                        absorptionFactor: 1.0,
                        envMapIntensity: 1.25,
                        squashFactor: 0.98,
                        diamondOrientedEnvMap: 0,
                        boostFactors: { x: 0.892, y: 0.892, z: 0.98595, isVector3: true }
                    }
                }
            };
        } else {
            return {
                name: comp.nodeName || 'metal',
                pbrMetallicRoughness: {
                    baseColorFactor: [0.99, 0.78, 0.35, 1.0], // Yellow gold default
                    metallicFactor: 1.0,
                    roughnessFactor: 0.18
                }
            };
        }
    });

    const hasDiamonds = components.some(c => c.role === 'diamond' || c.role === 'colored_gemstone' || c.role === 'accent_stone');
    const extensionsUsed = hasDiamonds ? ['WEBGI_materials_diamond'] : [];

    const gltf = {
        asset: {
            version: '2.0',
            generator: '3D-Ring-Configurator-CAD-Converter v1.0',
            extras: metadata
        },
        scenes: [{
            name: 'Scene',
            nodes: [gltfNodes.length]
        }],
        scene: 0,
        nodes: [...gltfNodes, {
            name: metadata.originalFileName || metadata.modelId || 'ModelRoot',
            children: gltfNodes.map((_, i) => i)
        }],
        meshes: gltfMeshes,
        materials,
        accessors,
        bufferViews,
        buffers: [{ byteLength: paddedBinaryBuffer.length }],
        extensionsUsed: extensionsUsed.length > 0 ? extensionsUsed : undefined
    };

    const jsonString = JSON.stringify(gltf);
    let jsonBuffer = Buffer.from(jsonString, 'utf-8');
    const jsonPad = (4 - (jsonBuffer.length % 4)) % 4;
    if (jsonPad > 0) {
        jsonBuffer = Buffer.concat([jsonBuffer, Buffer.from(' '.repeat(jsonPad), 'utf-8')]);
    }

    const totalLength = 12 + 8 + jsonBuffer.length + 8 + paddedBinaryBuffer.length;
    const header = Buffer.alloc(12);
    header.write('glTF', 0, 4, 'ascii');
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);

    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
    jsonHeader.write('JSON', 4, 4, 'ascii');

    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(paddedBinaryBuffer.length, 0);
    binHeader.write('BIN\0', 4, 4, 'ascii');

    return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, paddedBinaryBuffer]);
}

module.exports = {
    buildGLB
};

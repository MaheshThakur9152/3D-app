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
        let baseColorFactor = [0.75, 0.75, 0.75, 1.0]; // Neutral fallback
        let metallicFactor = 0.1;
        let roughnessFactor = 0.5;

        if (comp.sourceColor && Array.isArray(comp.sourceColor) && comp.sourceColor.length >= 3) {
            baseColorFactor = [
                comp.sourceColor[0],
                comp.sourceColor[1],
                comp.sourceColor[2],
                comp.sourceColor[3] !== undefined ? comp.sourceColor[3] : 1.0
            ];
            if (comp.sourceMetallic !== null && comp.sourceMetallic !== undefined) {
                metallicFactor = comp.sourceMetallic;
            } else if (comp.role && comp.role.startsWith('metal')) {
                metallicFactor = 0.8;
                roughnessFactor = 0.2;
            }
            if (comp.sourceRoughness !== null && comp.sourceRoughness !== undefined) {
                roughnessFactor = comp.sourceRoughness;
            }
        } else if (comp.role && comp.role.startsWith('metal')) {
            metallicFactor = 0.7;
            roughnessFactor = 0.3;
        }

        return {
            name: comp.nodeName || 'material',
            pbrMetallicRoughness: {
                baseColorFactor,
                metallicFactor,
                roughnessFactor
            }
        };
    });

    const extensionsUsed = [];

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

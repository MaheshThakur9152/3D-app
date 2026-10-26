/**
 * rhinoCadConverter.js
 * Ingests Rhino .3dm files using rhino3dm (OpenNURBS), extracts geometry,
 * classifies component roles, preserves diamond facet normals, transforms coordinates,
 * and produces valid GLB binary buffers and model manifests.
 */

const rhino3dm = require('rhino3dm');
const { computeFacetNormals, computeSmoothNormals } = require('./normalProcessor');
const { buildGLB } = require('./glbBuilder');

let rhinoInstance = null;
async function getRhino() {
    if (!rhinoInstance) {
        rhinoInstance = await rhino3dm();
    }
    return rhinoInstance;
}

// Check 3DM file signature
function isValid3dmSignature(buffer) {
    if (!buffer || buffer.length < 32) return false;
    const headerStr = buffer.slice(0, 32).toString('ascii');
    return headerStr.includes('3D Geometry') || headerStr.includes('3D Bi-orthogonal') || headerStr.includes('Rhinoceros');
}

// Check GLB file signature
function isValidGlbSignature(buffer) {
    if (!buffer || buffer.length < 12) return false;
    return buffer.slice(0, 4).toString('ascii') === 'glTF';
}

// Ingest native GLB file and build semantic model manifest
function parseGlbManifest(glbBuffer, modelId, originalFileName) {
    const chunkLen = glbBuffer.readUInt32LE(12);
    const chunkType = glbBuffer.slice(16, 20).toString('ascii');
    if (chunkType !== 'JSON') {
        throw new Error('Invalid GLB file: Chunk 0 is not JSON.');
    }

    const jsonStr = glbBuffer.slice(20, 20 + chunkLen).toString('utf-8');
    const gltf = JSON.parse(jsonStr);

    const components = [];
    const nodes = gltf.nodes || [];
    const meshes = gltf.meshes || [];
    const accessors = gltf.accessors || [];

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    nodes.forEach((node, idx) => {
        if (node.mesh !== undefined && meshes[node.mesh]) {
            const mesh = meshes[node.mesh];
            const nodeName = node.name || mesh.name || `Node_${idx}`;

            let triCount = 0;
            if (mesh.primitives) {
                mesh.primitives.forEach((prim) => {
                    if (prim.indices !== undefined && accessors[prim.indices]) {
                        triCount += Math.floor(accessors[prim.indices].count / 3);
                    }
                    if (prim.attributes && prim.attributes.POSITION !== undefined && accessors[prim.attributes.POSITION]) {
                        const posAcc = accessors[prim.attributes.POSITION];
                        if (posAcc.min && posAcc.max) {
                            minX = Math.min(minX, posAcc.min[0]);
                            minY = Math.min(minY, posAcc.min[1]);
                            minZ = Math.min(minZ, posAcc.min[2]);
                            maxX = Math.max(maxX, posAcc.max[0]);
                            maxY = Math.max(maxY, posAcc.max[1]);
                            maxZ = Math.max(maxZ, posAcc.max[2]);
                        }
                    }
                });
            }

            const classification = classifyRole(nodeName, nodeName, triCount);
            components.push({
                nodeId: nodeName,
                nodeName,
                sourceLayer: 'glTF_Mesh',
                role: classification.role,
                roleConfidence: classification.confidence,
                defaultMaterialPreset: classification.role.includes('diamond') ? 'diamond_clear' : 'gold_yellow',
                geometryStats: {
                    triangleCount: triCount,
                    vertexCount: 0,
                    isWatertight: true,
                    facetNormalsPreserved: classification.role.includes('diamond')
                }
            });
        }
    });

    if (minX === Infinity) {
        minX = -1.25; maxX = 1.25;
        minY = -1.25; maxY = 1.25;
        minZ = -1.25; maxZ = 1.25;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;
    const boundingRadius = Math.hypot(width / 2, height / 2, depth / 2);

    const manifest = {
        schemaVersion: '1.0.0',
        modelId,
        originalFileName,
        timestamp: new Date().toISOString(),
        units: 'mm',
        boundingDimensions: {
            width: Number(width.toFixed(3)),
            height: Number(height.toFixed(3)),
            depth: Number(depth.toFixed(3)),
            boundingRadius: Number(boundingRadius.toFixed(3))
        },
        components,
        warnings: []
    };

    return {
        glbBuffer,
        manifest,
        warnings: []
    };
}

// Role classification heuristic based on layer and object naming
function classifyRole(name, layerName, triangleCount) {
    const combined = `${name || ''} ${layerName || ''}`.toLowerCase();

    // Check for gemstone indicators
    if (combined.includes('diamond') || combined.includes('stone') || combined.includes('gem') || combined.includes('brilliant') || combined.includes('cushion') || combined.includes('round') || combined.includes('pave') || combined.includes('halo') || combined.includes('melee') || combined.includes('accent')) {
        if (combined.includes('pave') || combined.includes('halo') || combined.includes('melee') || combined.includes('accent') || combined.includes('side')) {
            return { role: 'accent_stone', confidence: 0.9 };
        }
        if (combined.includes('ruby') || combined.includes('emerald') || combined.includes('sapphire') || combined.includes('colored')) {
            return { role: 'colored_gemstone', confidence: 0.9 };
        }
        return { role: 'diamond', confidence: 0.95 };
    }

    // Check for metal component indicators
    if (combined.includes('prong') || combined.includes('claw')) {
        return { role: 'metal_prongs', confidence: 0.9 };
    }
    if (combined.includes('head') || combined.includes('collet') || combined.includes('basket') || combined.includes('bezel') || combined.includes('entourage')) {
        return { role: 'metal_head', confidence: 0.85 };
    }
    if (combined.includes('shank') || combined.includes('band') || combined.includes('rail') || combined.includes('ring') || combined.includes('alliance') || combined.includes('silver') || combined.includes('gold') || combined.includes('metal')) {
        return { role: 'metal_shank', confidence: 0.9 };
    }

    // Small faceted geometry in jewelry is gem
    if (triangleCount && triangleCount > 0 && triangleCount <= 128) {
        return { role: 'diamond', confidence: 0.7 };
    }

    // Explicitly unassigned or unknown objects
    if (combined.includes('default') || combined.includes('unknown') || combined.includes('misc')) {
        return { role: 'unassigned', confidence: 0.1 };
    }

    // Structural solid geometry in jewelry is metal by default
    return { role: 'metal_shank', confidence: 0.75 };
}

// Extract vertices, normals, and indices from a rhino.Mesh object
function extractMeshData(rhinoMesh) {
    const vertCount = rhinoMesh.vertices().count;
    const faceCount = rhinoMesh.faces().count;

    if (vertCount === 0 || faceCount === 0) return null;

    const positions = [];
    for (let i = 0; i < vertCount; i++) {
        const v = rhinoMesh.vertices().get(i);
        // Rhino is Z-up: (x, y, z) -> glTF Y-up: (x, z, -y)
        positions.push(v[0], v[2], -v[1]);
    }

    const indices = [];
    for (let f = 0; f < faceCount; f++) {
        const face = rhinoMesh.faces().get(f);
        const a = face[0];
        const b = face[1];
        const c = face[2];
        const d = face[3];

        indices.push(a, b, c);
        // If quad face (c !== d), add second triangle
        if (c !== d) {
            indices.push(a, c, d);
        }
    }

    return {
        positions: new Float32Array(positions),
        indices: indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
        isClosed: typeof rhinoMesh.isClosed === 'function' ? rhinoMesh.isClosed() : !!rhinoMesh.isClosed
    };
}

class RhinoCadConverter {
    async convert(fileBuffer, options = {}) {
        const warnings = [];
        const modelId = options.modelId || 'cad-model';
        const originalFileName = options.originalFileName || 'model.3dm';

        // Check if file is GLB
        if (isValidGlbSignature(fileBuffer)) {
            return parseGlbManifest(fileBuffer, modelId, originalFileName);
        }

        if (!isValid3dmSignature(fileBuffer)) {
            throw new Error('Invalid file format: input file is neither a valid Rhino .3dm nor a .glb file.');
        }

        const rhino = await getRhino();
        let doc;
        try {
            doc = rhino.File3dm.fromByteArray(new Uint8Array(fileBuffer));
        } catch (err) {
            throw new Error(`Failed to parse Rhino document: ${err.message}`);
        }

        if (!doc) {
            throw new Error('Failed to deserialize Rhino document.');
        }

        // Units
        let unitSystem = 'mm';
        if (doc.settings && doc.settings().modelUnitSystem) {
            const val = doc.settings().modelUnitSystem.value;
            if (val === 2) unitSystem = 'mm';
            else if (val === 3) unitSystem = 'cm';
            else if (val === 4) unitSystem = 'm';
            else if (val === 8) unitSystem = 'inches';
            else unitSystem = 'mm';
        }

        // Extract Layers
        const layers = [];
        const layerCount = doc.layers().count;
        for (let l = 0; l < layerCount; l++) {
            const layer = doc.layers().get(l);
            layers.push({
                index: l,
                name: layer.name,
                visible: layer.visible
            });
        }

        // Traverse Objects
        const objectCount = doc.objects().count;
        const extractedComponents = [];

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (let i = 0; i < objectCount; i++) {
            const obj = doc.objects().get(i);
            const attr = obj.attributes();
            const geom = obj.geometry();

            if (!geom) continue;

            const name = attr.name || `Component_${i}`;
            const layerIndex = attr.layerIndex;
            const layer = layers[layerIndex] || { name: 'Default', visible: true };

            // Skip hidden layers/objects unless requested
            if (!layer.visible) {
                warnings.push(`Object '${name}' on hidden layer '${layer.name}' skipped.`);
                continue;
            }

            let meshData = null;
            let geomType = geom.constructor ? geom.constructor.name : 'Unknown';

            if (geomType === 'Mesh') {
                meshData = extractMeshData(geom);
            } else if (geomType === 'Brep') {
                // Check for cached render meshes on Brep faces
                const faces = geom.faces();
                const faceCount = faces.count;
                const combinedMesh = new rhino.Mesh();

                for (let f = 0; f < faceCount; f++) {
                    const face = faces.get(f);
                    const renderMesh = face.getMesh(rhino.MeshType.Render);
                    if (renderMesh) {
                        combinedMesh.append(renderMesh);
                    }
                }

                if (combinedMesh.vertices().count > 0) {
                    meshData = extractMeshData(combinedMesh);
                } else {
                    warnings.push(`Brep '${name}' (Layer: '${layer.name}') does not contain pre-computed render meshes. Save with shaded view in Rhino or connect Rhino.Compute.`);
                }
            } else if (geomType === 'Extrusion') {
                const renderMesh = geom.getMesh(rhino.MeshType.Render);
                if (renderMesh) {
                    meshData = extractMeshData(renderMesh);
                } else {
                    warnings.push(`Extrusion '${name}' lacks render mesh.`);
                }
            } else if (geomType === 'InstanceReference') {
                // Dereference Block Instances (common for jewelry diamonds/prongs)
                const idef = doc.instanceDefinitions().findId(geom.parentIdefId);
                if (idef && idef.getObjectIds().length > 0) {
                    const masterObj = doc.objects().findId(idef.getObjectIds()[0]);
                    if (masterObj && masterObj.geometry() && masterObj.geometry().duplicate) {
                        const transformedGeom = masterObj.geometry().duplicate();
                        transformedGeom.transform(geom.xform);
                        if (transformedGeom.constructor.name === 'Brep') {
                            const combinedMesh = new rhino.Mesh();
                            for (let f = 0; f < transformedGeom.faces().count; f++) {
                                const rm = transformedGeom.faces().get(f).getMesh(rhino.MeshType.Render);
                                if (rm) combinedMesh.append(rm);
                            }
                            if (combinedMesh.vertices().count > 0) {
                                meshData = extractMeshData(combinedMesh);
                            }
                        } else if (transformedGeom.constructor.name === 'Mesh') {
                            meshData = extractMeshData(transformedGeom);
                        }
                    }
                }
            } else {
                warnings.push(`Geometry type '${geomType}' for object '${name}' is non-mesh and skipped.`);
            }

            if (!meshData || meshData.positions.length === 0) continue;

            const triangleCount = meshData.indices.length / 3;
            const classification = classifyRole(name, layer.name, triangleCount);
            const role = classification.role;

            // Normal processing based on role
            let processed;
            const isGemstone = role === 'diamond' || role === 'colored_gemstone' || role === 'accent_stone';
            if (isGemstone) {
                // Diamonds require sharp flat facet normals
                processed = computeFacetNormals(meshData.positions, meshData.indices);
            } else {
                // Metals require smooth averaged normals
                processed = computeSmoothNormals(meshData.positions, meshData.indices);
            }

            // Compute component bounding box
            let cMinX = Infinity, cMinY = Infinity, cMinZ = Infinity;
            let cMaxX = -Infinity, cMaxY = -Infinity, cMaxZ = -Infinity;
            for (let p = 0; p < processed.positions.length; p += 3) {
                const px = processed.positions[p];
                const py = processed.positions[p + 1];
                const pz = processed.positions[p + 2];

                if (px < cMinX) cMinX = px; if (px > cMaxX) cMaxX = px;
                if (py < cMinY) cMinY = py; if (py > cMaxY) cMaxY = py;
                if (pz < cMinZ) cMinZ = pz; if (pz > cMaxZ) cMaxZ = pz;

                if (px < minX) minX = px; if (px > maxX) maxX = px;
                if (py < minY) minY = py; if (py > maxY) maxY = py;
                if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
            }

            extractedComponents.push({
                nodeId: `node_${i}_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
                nodeName: name,
                sourceLayer: layer.name,
                role,
                roleConfidence: classification.confidence,
                defaultMaterialPreset: isGemstone ? 'diamond_clear' : (role === 'metal_shank' ? 'gold_yellow' : 'platinum'),
                positions: processed.positions,
                normals: processed.normals,
                indices: processed.indices,
                posMin: [cMinX, cMinY, cMinZ],
                posMax: [cMaxX, cMaxY, cMaxZ],
                geometryStats: {
                    triangleCount,
                    vertexCount: processed.positions.length / 3,
                    isWatertight: meshData.isClosed,
                    facetNormalsPreserved: isGemstone
                }
            });
        }

        if (extractedComponents.length === 0) {
            throw new Error('No renderable mesh geometry could be extracted from this .3dm file. Ensure the file contains meshes or was saved with render meshes.');
        }

        // Global dimensions & bounding radius
        const width = maxX - minX;
        const height = maxY - minY;
        const depth = maxZ - minZ;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        const rawBoundingRadius = Math.hypot(width / 2, height / 2, depth / 2);

        // Normalize scale for WebGi scene standard (radius ~1.35 units)
        // Rings modeled in mm (15-30mm) scale to ~1.35 so ground shadows, SSAO, SSR, and camera framing fit perfectly.
        const scaleFactor = rawBoundingRadius > 3.0 ? (1.35 / rawBoundingRadius) : 1.0;

        // Center components to world origin and apply scale normalization
        for (const comp of extractedComponents) {
            for (let p = 0; p < comp.positions.length; p += 3) {
                comp.positions[p] = (comp.positions[p] - centerX) * scaleFactor;
                comp.positions[p + 1] = (comp.positions[p + 1] - centerY) * scaleFactor;
                comp.positions[p + 2] = (comp.positions[p + 2] - centerZ) * scaleFactor;
            }
            comp.posMin = [
                (comp.posMin[0] - centerX) * scaleFactor,
                (comp.posMin[1] - centerY) * scaleFactor,
                (comp.posMin[2] - centerZ) * scaleFactor
            ];
            comp.posMax = [
                (comp.posMax[0] - centerX) * scaleFactor,
                (comp.posMax[1] - centerY) * scaleFactor,
                (comp.posMax[2] - centerZ) * scaleFactor
            ];
        }

        // Generate GLB buffer
        const glbBuffer = buildGLB(extractedComponents, {
            modelId,
            originalFileName,
            units: typeof unitSystem === 'string' ? unitSystem : 'mm'
        });

        // Generate Model Manifest
        const manifest = {
            schemaVersion: '1.0.0',
            modelId,
            originalFileName,
            timestamp: new Date().toISOString(),
            units: typeof unitSystem === 'string' ? unitSystem : 'mm',
            boundingDimensions: {
                width: Number(width.toFixed(3)),
                height: Number(height.toFixed(3)),
                depth: Number(depth.toFixed(3)),
                boundingRadius: Number(rawBoundingRadius.toFixed(3)),
                normalizedRadius: Number((rawBoundingRadius * scaleFactor).toFixed(3))
            },
            components: extractedComponents.map(c => ({
                nodeId: c.nodeId,
                nodeName: c.nodeName,
                sourceLayer: c.sourceLayer,
                role: c.role,
                roleConfidence: c.roleConfidence,
                defaultMaterialPreset: c.defaultMaterialPreset,
                geometryStats: c.geometryStats
            })),
            warnings
        };

        return {
            glbBuffer,
            manifest,
            warnings
        };
    }
}

module.exports = {
    RhinoCadConverter,
    isValid3dmSignature,
    isValidGlbSignature,
    classifyRole
};

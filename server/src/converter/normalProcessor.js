/**
 * normalProcessor.js
 * Specialized vertex normal computation for jewelry rendering.
 * - Diamonds: Flat, un-smoothed facet normals (critical for WebGi DiamondPlugin refraction).
 * - Metals: Smooth averaged normals on continuous sweeps.
 */

function computeFacetNormals(positions, indices) {
    const unindexedPositions = [];
    const unindexedNormals = [];
    const newIndices = [];

    const numTriangles = indices.length / 3;

    for (let t = 0; t < numTriangles; t++) {
        const i0 = indices[t * 3];
        const i1 = indices[t * 3 + 1];
        const i2 = indices[t * 3 + 2];

        const x0 = positions[i0 * 3], y0 = positions[i0 * 3 + 1], z0 = positions[i0 * 3 + 2];
        const x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2];
        const x2 = positions[i2 * 3], y2 = positions[i2 * 3 + 1], z2 = positions[i2 * 3 + 2];

        // Edge vectors
        const ax = x1 - x0, ay = y1 - y0, az = z1 - z0;
        const bx = x2 - x0, by = y2 - y0, bz = z2 - z0;

        // Cross product: a x b
        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;

        // Normalize
        const len = Math.hypot(nx, ny, nz);
        if (len > 1e-7) {
            nx /= len;
            ny /= len;
            nz /= len;
        } else {
            nx = 0; ny = 1; nz = 0;
        }

        const baseIdx = t * 3;
        unindexedPositions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
        unindexedNormals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        newIndices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    }

    return {
        positions: new Float32Array(unindexedPositions),
        normals: new Float32Array(unindexedNormals),
        indices: newIndices.length > 65535 ? new Uint32Array(newIndices) : new Uint16Array(newIndices)
    };
}

function computeSmoothNormals(positions, indices) {
    const numVertices = positions.length / 3;
    const normals = new Float32Array(numVertices * 3);

    const numTriangles = indices.length / 3;
    for (let t = 0; t < numTriangles; t++) {
        const i0 = indices[t * 3];
        const i1 = indices[t * 3 + 1];
        const i2 = indices[t * 3 + 2];

        const x0 = positions[i0 * 3], y0 = positions[i0 * 3 + 1], z0 = positions[i0 * 3 + 2];
        const x1 = positions[i1 * 3], y1 = positions[i1 * 3 + 1], z1 = positions[i1 * 3 + 2];
        const x2 = positions[i2 * 3], y2 = positions[i2 * 3 + 1], z2 = positions[i2 * 3 + 2];

        const ax = x1 - x0, ay = y1 - y0, az = z1 - z0;
        const bx = x2 - x0, by = y2 - y0, bz = z2 - z0;

        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;

        normals[i0 * 3] += nx; normals[i0 * 3 + 1] += ny; normals[i0 * 3 + 2] += nz;
        normals[i1 * 3] += nx; normals[i1 * 3 + 1] += ny; normals[i1 * 3 + 2] += nz;
        normals[i2 * 3] += nx; normals[i2 * 3 + 1] += ny; normals[i2 * 3 + 2] += nz;
    }

    for (let v = 0; v < numVertices; v++) {
        let nx = normals[v * 3];
        let ny = normals[v * 3 + 1];
        let nz = normals[v * 3 + 2];
        const len = Math.hypot(nx, ny, nz);
        if (len > 1e-7) {
            normals[v * 3] = nx / len;
            normals[v * 3 + 1] = ny / len;
            normals[v * 3 + 2] = nz / len;
        } else {
            normals[v * 3] = 0;
            normals[v * 3 + 1] = 1;
            normals[v * 3 + 2] = 0;
        }
    }

    return {
        positions: positions instanceof Float32Array ? positions : new Float32Array(positions),
        normals,
        indices: indices instanceof Uint16Array || indices instanceof Uint32Array ? indices : (indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices))
    };
}

module.exports = {
    computeFacetNormals,
    computeSmoothNormals
};

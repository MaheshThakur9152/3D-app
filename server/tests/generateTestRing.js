/**
 * generateTestRing.js
 * Generates a realistic test ring CAD file (.3dm) containing a shank and faceted diamond.
 */

const rhino3dm = require('rhino3dm');

async function createTestRing3dm() {
    const rhino = await rhino3dm();
    const doc = new rhino.File3dm();

    // 1. Layer table
    const shankLayer = new rhino.Layer();
    shankLayer.name = 'SHANK::18K_GOLD';
    shankLayer.color = { r: 255, g: 215, b: 0, a: 255 };
    doc.layers().add(shankLayer);

    const diamondLayer = new rhino.Layer();
    diamondLayer.name = 'GEM::CENTER_DIAMOND';
    diamondLayer.color = { r: 220, g: 245, b: 255, a: 255 };
    doc.layers().add(diamondLayer);

    // 2. Shank Mesh (ring band with 16 segments)
    const shankMesh = new rhino.Mesh();
    const R_outer = 10.0;
    const R_inner = 8.5;
    const width = 3.0;
    const segments = 16;

    for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        // 4 vertices per slice
        shankMesh.vertices().add(R_outer * cos, -width / 2, R_outer * sin); // 0
        shankMesh.vertices().add(R_outer * cos, width / 2, R_outer * sin);  // 1
        shankMesh.vertices().add(R_inner * cos, width / 2, R_inner * sin);  // 2
        shankMesh.vertices().add(R_inner * cos, -width / 2, R_inner * sin); // 3
    }

    for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments;
        const b = i * 4;
        const nb = next * 4;

        // Outer face
        shankMesh.faces().addQuadFace(b + 0, nb + 0, nb + 1, b + 1);
        // Top edge
        shankMesh.faces().addQuadFace(b + 1, nb + 1, nb + 2, b + 2);
        // Inner face
        shankMesh.faces().addQuadFace(b + 2, nb + 2, nb + 3, b + 3);
        // Bottom edge
        shankMesh.faces().addQuadFace(b + 3, nb + 3, nb + 0, b + 0);
    }
    shankMesh.normals().computeNormals();

    const shankAttr = new rhino.ObjectAttributes();
    shankAttr.name = 'Ring_Shank_Solid';
    shankAttr.layerIndex = 0;
    doc.objects().addMesh(shankMesh, shankAttr);

    // 3. Faceted Diamond Mesh (Octahedron diamond shape)
    const diamondMesh = new rhino.Mesh();
    const cz = R_outer + 1.5;
    const r = 2.5;
    const h_table = 1.0;
    const h_culet = -2.0;

    // Center top (table)
    diamondMesh.vertices().add(0, 0, cz + h_table); // 0
    // Girdle vertices (8 facets)
    const gSegs = 8;
    for (let i = 0; i < gSegs; i++) {
        const theta = (i / gSegs) * Math.PI * 2;
        diamondMesh.vertices().add(r * Math.cos(theta), r * Math.sin(theta), cz);
    }
    // Culet (bottom point)
    diamondMesh.vertices().add(0, 0, cz + h_culet); // 9

    // Crown facets (table to girdle)
    for (let i = 0; i < gSegs; i++) {
        const next = (i + 1) % gSegs;
        diamondMesh.faces().addTriFace(0, 1 + i, 1 + next);
    }
    // Pavilion facets (girdle to culet)
    for (let i = 0; i < gSegs; i++) {
        const next = (i + 1) % gSegs;
        diamondMesh.faces().addTriFace(9, 1 + next, 1 + i);
    }
    diamondMesh.normals().computeNormals();

    const diaAttr = new rhino.ObjectAttributes();
    diaAttr.name = 'Center_Diamond_Brilliant';
    diaAttr.layerIndex = 1;
    doc.objects().addMesh(diamondMesh, diaAttr);

    const byteArray = doc.toByteArray();
    return Buffer.from(byteArray);
}

module.exports = {
    createTestRing3dm
};

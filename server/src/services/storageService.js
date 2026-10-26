/**
 * storageService.js
 * Handles immutable original CAD file storage and processed GLB/manifest persistence.
 */

const fs = require('fs');
const path = require('path');

class StorageService {
    constructor(baseDir) {
        this.baseDir = baseDir || path.resolve(__dirname, '../../storage');
        this.uploadsDir = path.join(this.baseDir, 'uploads');
        this.processedDir = path.join(this.baseDir, 'processed');

        this._ensureDirectories();
    }

    _ensureDirectories() {
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
        if (!fs.existsSync(this.processedDir)) {
            fs.mkdirSync(this.processedDir, { recursive: true });
        }
    }

    async saveOriginalCad(modelId, originalFileName, buffer) {
        const ext = path.extname(originalFileName || '').toLowerCase() || '.3dm';
        const filePath = path.join(this.uploadsDir, `${modelId}${ext}`);
        await fs.promises.writeFile(filePath, buffer);
        return {
            modelId,
            filePath,
            size: buffer.length
        };
    }

    async saveProcessedAssets(modelId, glbBuffer, manifest) {
        const glbPath = path.join(this.processedDir, `${modelId}.glb`);
        const manifestPath = path.join(this.processedDir, `${modelId}.manifest.json`);

        await fs.promises.writeFile(glbPath, glbBuffer);
        await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

        return {
            glbPath,
            manifestPath,
            glbSize: glbBuffer.length
        };
    }

    async getManifest(modelId) {
        const manifestPath = path.join(this.processedDir, `${modelId}.manifest.json`);
        if (!fs.existsSync(manifestPath)) {
            return null;
        }
        const data = await fs.promises.readFile(manifestPath, 'utf-8');
        return JSON.parse(data);
    }

    async updateManifest(modelId, updatedManifest) {
        const manifestPath = path.join(this.processedDir, `${modelId}.manifest.json`);
        await fs.promises.writeFile(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf-8');
        return updatedManifest;
    }

    getGlbPath(modelId) {
        const glbPath = path.join(this.processedDir, `${modelId}.glb`);
        return fs.existsSync(glbPath) ? glbPath : null;
    }

    getOriginalCadPath(modelId) {
        const cadPath3dm = path.join(this.uploadsDir, `${modelId}.3dm`);
        if (fs.existsSync(cadPath3dm)) return cadPath3dm;
        const cadPathGlb = path.join(this.uploadsDir, `${modelId}.glb`);
        if (fs.existsSync(cadPathGlb)) return cadPathGlb;
        return null;
    }
}

module.exports = {
    StorageService
};

/**
 * config.js
 * Application configuration loaded from environment variables with validation.
 */

const path = require('path');
require('dotenv').config();

const config = {
    port: parseInt(process.env.PORT || '5000', 10),
    storageDir: process.env.STORAGE_DIR
        ? path.resolve(process.env.STORAGE_DIR)
        : path.resolve(__dirname, '../../storage'),
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rhinoComputeUrl: process.env.RHINO_COMPUTE_URL || null,
    rhinoComputeKey: process.env.RHINO_COMPUTE_KEY || null,
    queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '2', 10)
};

module.exports = config;

/**
 * db/migrate.js
 * Safe, idempotent database schema migration and seed initialization.
 */

const { getPool, query } = require('./index');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS models (
    id VARCHAR(64) PRIMARY KEY,
    original_filename TEXT NOT NULL,
    source_format VARCHAR(16) NOT NULL,
    original_asset_path TEXT NOT NULL,
    processed_asset_path TEXT,
    manifest_path TEXT,
    source_units VARCHAR(16) DEFAULT 'mm',
    source_dimensions JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    processing_version VARCHAR(16) DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversion_jobs (
    id VARCHAR(64) PRIMARY KEY,
    model_id VARCHAR(64) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    current_stage VARCHAR(64) DEFAULT 'queued',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    worker_version VARCHAR(16) DEFAULT '1.0.0',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS component_role_overrides (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(64) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL,
    grouping VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(model_id, node_id)
);

CREATE TABLE IF NOT EXISTS ring_configurations (
    id VARCHAR(64) PRIMARY KEY,
    model_id VARCHAR(64) NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL DEFAULT 'Default Configuration',
    version INTEGER NOT NULL DEFAULT 1,
    material_assignments JSONB NOT NULL DEFAULT '{}'::jsonb,
    parameter_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    studio_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_presets (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    parameters JSONB NOT NULL,
    preview_metadata JSONB,
    schema_version VARCHAR(16) DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS studio_presets (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    background_color VARCHAR(32) NOT NULL,
    ground_settings JSONB NOT NULL,
    environment_settings JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const SEED_PRESETS_SQL = `
INSERT INTO studio_presets (id, name, background_color, ground_settings, environment_settings)
VALUES
    ('white', 'Pure White', '#ffffff', '{"visible":true,"shadows":true,"reflections":true}', '{"intensity":1.0,"rotationDeg":0}'),
    ('neutral', 'Studio Neutral', '#f5f5f7', '{"visible":true,"shadows":true,"reflections":true}', '{"intensity":1.0,"rotationDeg":0}'),
    ('warm', 'Warm Ivory', '#faf7f2', '{"visible":true,"shadows":true,"reflections":true}', '{"intensity":1.0,"rotationDeg":0}'),
    ('pink', 'Blush Pink', '#eeb7b5', '{"visible":true,"shadows":true,"reflections":true}', '{"intensity":1.0,"rotationDeg":0}'),
    ('dark', 'Velvet Dark', '#1c1324', '{"visible":true,"shadows":true,"reflections":true}', '{"intensity":1.2,"rotationDeg":0}')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    background_color = EXCLUDED.background_color,
    ground_settings = EXCLUDED.ground_settings,
    environment_settings = EXCLUDED.environment_settings;

INSERT INTO material_presets (id, name, kind, parameters)
VALUES
    ('yellow_gold', 'Yellow Gold 18K', 'metal', '{"color":"#fed250","metalness":1.0,"roughness":0.08}'),
    ('white_gold', 'White Gold / Platinum', 'metal', '{"color":"#eef0f2","metalness":1.0,"roughness":0.06}'),
    ('rose_gold', 'Rose Gold 18K', 'metal', '{"color":"#f4a896","metalness":1.0,"roughness":0.08}'),
    ('diamond', 'Brilliant Diamond', 'diamond', '{"color":"#cfecec","refractiveIndex":2.417,"dispersion":0.044,"absorptionFactor":1.0,"envMapIntensity":1.35}'),
    ('ruby', 'Vivid Ruby', 'gemstone', '{"color":"#f70db1","refractiveIndex":1.77,"dispersion":0.018,"absorptionFactor":1.5,"envMapIntensity":1.25}'),
    ('emerald', 'Colombian Emerald', 'gemstone', '{"color":"#5eca00","refractiveIndex":1.58,"dispersion":0.014,"absorptionFactor":2.0,"envMapIntensity":1.25}'),
    ('sapphire', 'Royal Sapphire', 'gemstone', '{"color":"#1766bb","refractiveIndex":1.77,"dispersion":0.018,"absorptionFactor":1.5,"envMapIntensity":1.25}'),
    ('aquamarine', 'Aquamarine', 'gemstone', '{"color":"#62cffe","refractiveIndex":1.58,"dispersion":0.014,"absorptionFactor":1.0,"envMapIntensity":1.25}'),
    ('canary', 'Canary Diamond', 'diamond', '{"color":"#efe75b","refractiveIndex":2.417,"dispersion":0.044,"absorptionFactor":1.2,"envMapIntensity":1.35}'),
    ('pink_diamond', 'Pink Diamond', 'diamond', '{"color":"#fa37d7","refractiveIndex":2.417,"dispersion":0.044,"absorptionFactor":1.2,"envMapIntensity":1.35}')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    parameters = EXCLUDED.parameters;
`;

const SEED_MODELS_SQL = `
INSERT INTO models (id, original_filename, source_format, original_asset_path, processed_asset_path, manifest_path, source_units, status)
VALUES
    ('builtin-ring-1', 'ring_webgi.glb', 'glb', 'assets/ring_webgi.glb', 'assets/ring_webgi.glb', 'builtin-ring-1.manifest.json', 'mm', 'completed'),
    ('builtin-ring-2', 'ring2_webgi.glb', 'glb', 'assets/ring2_webgi.glb', 'assets/ring2_webgi.glb', 'builtin-ring-2.manifest.json', 'mm', 'completed')
ON CONFLICT (id) DO NOTHING;
`;

async function runMigrations() {
    const p = getPool();
    if (!p) {
        console.log('[Migrate] No PostgreSQL configuration detected; skipping DB migration.');
        return false;
    }

    try {
        console.log('[Migrate] Applying database schema migrations...');
        await p.query(SCHEMA_SQL);
        console.log('[Migrate] Seeding default presets...');
        await p.query(SEED_PRESETS_SQL);
        console.log('[Migrate] Seeding built-in models...');
        await p.query(SEED_MODELS_SQL);
        console.log('[Migrate] Migrations and seeds applied successfully.');
        return true;
    } catch (err) {
        console.error('[Migrate] Migration failed:', err.message);
        throw err;
    }
}

if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = {
    runMigrations
};

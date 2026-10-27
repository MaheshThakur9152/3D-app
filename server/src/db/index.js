/**
 * db/index.js
 * PostgreSQL connection pool and query helper.
 * Gracefully operates in memory / bypass mode when no Postgres connection is available.
 */

const { Pool } = require('pg');

let pool = null;
let isConnected = false;

function getPool() {
    if (pool) return pool;

    const connectionString = process.env.DATABASE_URL ||
        (process.env.PGHOST ? `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'mahesh3d'}` : null);

    if (!connectionString) {
        return null;
    }

    pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000
    });

    pool.on('error', (err) => {
        console.error('[DB] Unexpected error on idle client', err.message);
    });

    return pool;
}

async function query(text, params) {
    const p = getPool();
    if (!p) return null;
    return p.query(text, params);
}

async function testConnection() {
    const p = getPool();
    if (!p) return false;
    try {
        const res = await p.query('SELECT NOW()');
        isConnected = !!res;
        return isConnected;
    } catch (err) {
        console.warn('[DB] Postgres connection not available:', err.message);
        isConnected = false;
        return false;
    }
}

function hasDb() {
    return isConnected;
}

module.exports = {
    getPool,
    query,
    testConnection,
    hasDb
};

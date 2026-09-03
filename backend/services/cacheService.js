const db = require('../database/db');
const { getSetting } = require('./settingsService');

const getStmt = db.prepare('SELECT result_json, provider, created_at FROM cache WHERE cache_key = ?');
const setStmt = db.prepare(
    'INSERT INTO cache (cache_key, result_json, provider, created_at) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(cache_key) DO UPDATE SET result_json = excluded.result_json, provider = excluded.provider, created_at = excluded.created_at'
);
const deleteStmt = db.prepare('DELETE FROM cache WHERE cache_key = ?');

function buildCacheKey(asin, postalCode, quantity) {
    return `${asin.toUpperCase()}_${postalCode}_${quantity}`;
}

function getCacheDurationMinutes() {
    const configured = getSetting('CACHE_DURATION_MINUTES') || process.env.CACHE_DURATION_MINUTES;
    const n = Number(configured);
    return Number.isFinite(n) && n >= 0 ? n : 30;
}

/** Returns { result, ageMinutes } if a fresh cache entry exists, else null. */
function getCached(asin, postalCode, quantity) {
    const key = buildCacheKey(asin, postalCode, quantity);
    const row = getStmt.get(key);
    if (!row) return null;

    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const ageMinutes = ageMs / 60000;
    const ttl = getCacheDurationMinutes();

    if (ttl === 0 || ageMinutes > ttl) {
        deleteStmt.run(key);
        return null;
    }

    return {
        result: JSON.parse(row.result_json),
        provider: row.provider,
        ageMinutes: Math.round(ageMinutes),
    };
}

function setCached(asin, postalCode, quantity, result, providerMode) {
    const key = buildCacheKey(asin, postalCode, quantity);
    setStmt.run(key, JSON.stringify(result), providerMode, new Date().toISOString());
}

function invalidate(asin, postalCode, quantity) {
    deleteStmt.run(buildCacheKey(asin, postalCode, quantity));
}

module.exports = { buildCacheKey, getCached, setCached, invalidate, getCacheDurationMinutes };
